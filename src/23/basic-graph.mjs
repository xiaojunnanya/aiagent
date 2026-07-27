import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

// 定义图中所有节点共享的状态字段。
const StateAnnotation = Annotation.Root({
  text: Annotation({
    reducer: (_prev, next) => next, // 当节点返回新的 text 时，如何把新值和旧值合并。
    default: () => "", // 初始值。
  }),
});

// 每个节点接收当前状态，并只返回自己要更新的字段。
const step1 = (state) => ({ text: `${state.text} -> step1` });
const step2 = (state) => ({ text: `${state.text} -> step2` });

// 创建线性工作流：START -> step1 -> step2 -> END。
const graph = new StateGraph(StateAnnotation)
  .addNode("step1", step1) // 节点名称: step1，节点函数: step1。
  .addNode("step2", step2) // 节点名称: step2，节点函数: step2。
  .addEdge(START, "step1") // 起点: START，终点: step1。
  .addEdge("step1", "step2") // 起点: step1，终点: step2。
  .addEdge("step2", END) // 起点: step2，终点: END。
  .compile(); // 编译图，生成可执行的函数。

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
// 获取的是当前工作流的图结构
const drawable = await graph.getGraphAsync();
// 将图结构转换为 Mermaid 格式
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

// 使用初始状态执行整个工作流。
const result = await graph.invoke({ text: "hello" });
console.log("result:", result);
