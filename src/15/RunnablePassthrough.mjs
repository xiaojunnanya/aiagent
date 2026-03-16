import "dotenv/config";
import {
  RunnablePassthrough,
  RunnableLambda,
  RunnableSequence,
  RunnableMap,
} from "@langchain/core/runnables";

// const chain = RunnableSequence.from([
//   // 将输入转换为对象，为{ concept: "teSta" }
//   RunnableLambda.from((input) => ({ concept: input + "a" })),
//   // 将对象转换为另一个对象
//   RunnableMap.from({
//     // 将输入原封不动地传递下去
//     original: new RunnablePassthrough(),
//     processed: RunnableLambda.from((obj) => ({
//       // 这里的 obj 是上面 RunnableLambda.from((input) => ({ concept: input + "a" })) 的输出
//       concept: obj.concept,
//       upper: obj.concept.toUpperCase(),
//       length: obj.concept.length,
//     })),
//   }),
// ]);

const chain = RunnableSequence.from([
  (input) => ({ concept: input + "a" }),
  RunnablePassthrough.assign({
    original: new RunnablePassthrough(),
    processed: (obj) => ({
      concept: obj.concept,
      upper: obj.concept.toUpperCase(),
      length: obj.concept.length,
    }),
  }),
]);

const input = "teSt";
const result = await chain.invoke(input);
console.log("✅ 最终结果:", result);
