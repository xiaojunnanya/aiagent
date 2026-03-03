import "dotenv/config";
import {
  MilvusClient,
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

// 集合名
const COLLECTION_NAME = "ai_diary";
// 1024 是向量维度，必须和 embedding 模型输出维度一致
const VECTOR_DIM = 1024;
// 怎么知道 embedding 模型输出维度？下面代码打印一下即可
// const result = await embeddings.embedQuery("测试一下");
// console.log(result.length);

// 初始化 Embedding 模型，用于将文本转换为向量
// 向量的核心作用：用数学方式表达语义相似度
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

// 连接 Milvus 数据库
const client = new MilvusClient({
  address: "localhost:19530",
});

// 把文本变成向量
// 比如："今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。" 会变成 [0.0231, -0.8123, 0.3312, ...] 这样的向量
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    console.log("Connecting to Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");

    // 创建集合（类似于创建mysql数据库表）
    console.log("Creating collection...");
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "id",
          data_type: DataType.VarChar,
          max_length: 50,
          is_primary_key: true, // 主键
        },
        // 核心字段，类型：FloatVector，维度：1024
        { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM }, // 向量
        // 非核心字段，类型：VarChar，最大长度：5000
        { name: "content", data_type: DataType.VarChar, max_length: 5000 }, // 内容
        // 非核心字段，类型：VarChar，最大长度：50
        { name: "date", data_type: DataType.VarChar, max_length: 50 }, // 日期
        // 非核心字段，类型：VarChar，最大长度：50
        { name: "mood", data_type: DataType.VarChar, max_length: 50 }, // 心情
        // 非核心字段，类型：Array，元素类型：VarChar，最大容量：10，最大长度：50
        {
          name: "tags",
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          max_capacity: 10,
          max_length: 50,
        },
      ],
    });

    console.log("Collection created");

    // 创建索引（类似于创建mysql索引）,性能优化的关键
    console.log("\nCreating index...");
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector",
      index_type: IndexType.IVF_FLAT, // 索引类型，常用的有：IVF_FLAT（倒排文件索引）、IVF_SQ8、IVF_PQ
      metric_type: MetricType.COSINE, // 相似度计算方式，常用的有：COSINE（余弦相似度）、L2（欧氏距离）、IP（内积）
      params: { nlist: 1024 }, // 表示聚类数量，越大越精确，但查询速度越慢
    });
    console.log("Index created");

    // 加载集合，这一步很重要，milvus 只有 load 进内存才能搜索
    console.log("\nLoading collection...");
    await client.loadCollection({ collection_name: COLLECTION_NAME });
    console.log("Collection loaded");

    // 插入日记数据
    console.log("\nInserting diary entries...");
    const diaryContents = [
      {
        id: "diary_001",
        content:
          "今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。",
        date: "2026-01-10",
        mood: "happy",
        tags: ["生活", "散步"],
      },
      {
        id: "diary_002",
        content:
          "今天工作很忙，完成了一个重要的项目里程碑。团队合作很愉快，感觉很有成就感。",
        date: "2026-01-11",
        mood: "excited",
        tags: ["工作", "成就"],
      },
      {
        id: "diary_003",
        content:
          "周末和朋友去爬山，天气很好，心情也很放松。享受大自然的感觉真好。",
        date: "2026-01-12",
        mood: "relaxed",
        tags: ["户外", "朋友"],
      },
      {
        id: "diary_004",
        content:
          "今天学习了 Milvus 向量数据库，感觉很有意思。向量搜索技术真的很强大。",
        date: "2026-01-12",
        mood: "curious",
        tags: ["学习", "技术"],
      },
      {
        id: "diary_005",
        content:
          "晚上做了一顿丰盛的晚餐，尝试了新菜谱。家人都说很好吃，很有成就感。",
        date: "2026-01-13",
        mood: "proud",
        tags: ["美食", "家庭"],
      },
    ];

    // 把文本变成向量
    console.log("Generating embeddings...");
    const diaryData = await Promise.all(
      diaryContents.map(async (diary) => ({
        ...diary,
        vector: await getEmbedding(diary.content),
      }))
    );

    // 插入数据
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: diaryData,
    });
    console.log(`✓ Inserted ${insertResult.insert_cnt} records\n`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
