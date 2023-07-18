import { Button, Input } from "antd";
import styles from "./chat.module.less";
import { useState } from "react";
import ws from "@app/utils/websocket";
import { debounce } from "lodash";
import ngqlDoc from "./ngql.json";
import rootStore from "@app/stores";
import CodeMirror from "@app/components/CodeMirror";

const ngqlMap = ngqlDoc.reduce((acc, item) => {
  item.url = item.url.replace(
    "https://docs.nebula-graph.io/3.5.0/3.ngql-guide/",
    ""
  );
  acc[item.url] = item;
  return acc;
});
const categoryDict =
  "[" +
  ngqlDoc
    .map(
      (item) =>
        `"${item.url.replace(
          "https://docs.nebula-graph.io/3.5.0/3.ngql-guide/",
          ""
        )}"`
    )
    .join(",") +
  "]";
const matchPrompt = `Generate NebulaGraph query from natural language.
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.
Schema:
---
{schema}
---
Note: NebulaGraph speaks a dialect of Cypher, comparing to standard Cypher:
1. it uses double equals sign for comparison: == rather than =
2. it needs explicit label specification when referring to node properties, i.e.
v is a variable of a node, and we know its label is Foo, v.foo.name is correct
while v.name is not.
For example, see this diff between standard and NebulaGraph Cypher dialect:
diff
< MATCH (p:person)-[:directed]->(m:movie) WHERE m.name = 'The Godfather'
< RETURN p.name;
---
> MATCH (p:person)-[:directed]->(m:movie) WHERE m.movie.name == 'The Godfather'
> RETURN p.person.name;
NebulaGraph Cypher dialect query:`;

function Chat() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState([]); // [{role: 'user', content: 'hello'}, {role: 'system', content: 'hello'}
  const onSend = debounce(async () => {
    setPending(true);
    // just use last 5 message
    const beforeMessages = [
      ...messages.slice(messages.length - 5, messages.length),
    ];
    const newMessages = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setText("");
    setMessages(newMessages);
    const systemPrompt = await GetDocPrompt(text);
    const sendMessages = [
      {
        role: "system",
        content:
          "You are a helpful NebulaGraph database assistant to help user write the ngql. you need use markdown to reply short and clear.",
      },
      // slice 100 char
      ...beforeMessages.map((item) => ({
        ...item,
        content: item.content.trim().slice(-100),
      })),
      // {
      //   role: 'user',
      //   content: /[\u4e00-\u9fa5]/.test(text) ? "请使用中文":"Please use English"
      // },
      {
        role: "user",
        content: systemPrompt,
      },
    ];
    ws.runChat({
      req: {
        stream: true,
        temperature: 0.7,
        max_tokens: 200,
        messages: sendMessages,
      },
      callback: (res) => {
        if (res.message.done) {
          setPending(false);
          return;
        }
        try {
          const text = res.message.choices[0].delta?.content || "";
          newMessages[newMessages.length - 1].content += text;
          setMessages([...newMessages]);
        } catch (e) {
          console.log(e, res.message);
        }
      },
    });
  }, 200);

  async function GetDocPrompt(text) {
    let prompt = matchPrompt;
    const { schema } = rootStore;
    const res = (await ws.runChat({
      req: {
        temperature: 0.5,
        stream: false,
        max_tokens: 30,
        messages: [
          {
            role: "system",
            content: `graph database doc titles array is below:${categoryDict}.give me a most relevant doc path for the question: ${text}, do not write explanation for the path, just give me the path without any prefix words.`,
          },
        ],
      },
    })) as any;
    if (res.code === 0) {
      const url = res.message.choices[0].message?.content;
      console.log("relation url:", url);
      if (ngqlMap[url]) {
        const doc = ngqlMap[url]?.content;
        if (doc) {
          prompt = `learn the below nGQL, and use it to help user write the ngql,the user space schema is "{schema}", the user space vid type is "${
            schema.spaceVidType
          }" the doc is: \n"${doc
            .replaceAll("  ", "")
            .replaceAll("\n", "")
            .slice(
              0,
              1000
            )}"\n the question is "{query_str}",you need think more and more.and add \`\`\` as markdown code block to write the gql.`;
        }
      }
    }
    prompt = prompt.replace("{query_str}", text);
    const pathname = window.location.pathname;
    const space =
      pathname.indexOf("schema") > -1
        ? rootStore.schema.currentSpace
        : rootStore.console.currentSpace;
    if (!space) {
      return prompt.replace("{schema}", "tags:\n" + "edges:\n");
    }
    await schema.switchSpace(space);
    await schema.getTagList();
    await schema.getEdgeList();
    const { tagList, edgeList } = rootStore.schema;
    const tagsSchema = tagList
      .map((item) => {
        return `${item.name}[${item.fields
          .map((p) => p.Field + `(${p.Type})`)
          .join(",")}]`;
      })
      .join("\n");
    const edgeTypesSchema = edgeList
      .map((item) => {
        return `${item.name}[${item.fields
          .map((p) => p.Field + `(${p.Type})`)
          .join(",")}]`;
      })
      .join("\n");

    prompt = prompt.replace(
      "{schema}",
      "tags:\n:" + tagsSchema + "\nedges:\n" + edgeTypesSchema
    );
    return prompt;
  }

  function renderContent(content) {
    const gqls = content.split(/```([^`]+)```/);
    return gqls.map((item, index) => {
      if (index % 2 === 0) {
        return <p key={index}>{item}</p>;
      } else {
        item = item.replace(/^(\n|ngql|gql)/g, "");
        if (pending) {
          return <code>{item}</code>;
        }
        return (
          <div className={styles.codeWrapper}>
            <span
              onClick={() => {
                runNgqlInConsole(item);
              }}
            >
              Run
            </span>
            <CodeMirror
              height={item.split("\n").length * 20 + ""}
              value={item}
              options={{
                type: "nebula",
              }}
            />
          </div>
        );
      }
    });
  }

  function runNgqlInConsole(item) {
    rootStore.console.runGQL({ gql: item });
  }
  return (
    <div className={styles.chat}>
      <div className={styles.chatContent}>
        <div className={styles.chatContentInner}>
          {messages.map((item, index) => {
            return (
              <div
                key={index}
                className={
                  styles.chatMessage +
                  " " +
                  styles[item.role == "user" ? "fromUser" : "fromBot"]
                }
              >
                <div className={styles.chatMessageInner}>
                  <div className={styles.chatMessageContent}>
                    {renderContent(item.content || "...")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.chatInput}>
        <Input.TextArea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button type="primary" size="small" onClick={onSend}>
          Send
        </Button>
      </div>
    </div>
  );
}

export default Chat;
