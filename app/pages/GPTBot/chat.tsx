import { Button, Input } from "antd";
import styles from "./chat.module.less";
import { useEffect, useRef, useState } from "react";
import ws from "@app/utils/websocket";
import { debounce } from "lodash";
import rootStore from "@app/stores";
import CodeMirror from "@app/components/CodeMirror";
import { observer } from "mobx-react-lite";

function Chat() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const contentRef = useRef<HTMLDivElement>();
  const [messages, setMessages] = useState([]); // [{role: 'user', content: 'hello'}, {role: 'system', content: 'hello'}
  const onSend = debounce(async () => {
    if (text === "") return;
    setPending(true);
    // just use last 5 message
    const beforeMessages =
      rootStore.gpt.mode === "text2cypher"
        ? []
        : [...messages.slice(messages.length - 5, messages.length)];
    const newMessages = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "", status: "pending" },
    ];
    setText("");
    setMessages(newMessages);
    const systemPrompt = await rootStore.gpt.getDocPrompt(text);
    const sendMessages = [
      {
        role: "system",
        content:
          "You are a helpful NebulaGraph database NGQL assistant to help user write the ngql",
      },
      // slice 100 char
      ...beforeMessages.map((item) => ({
        role: item.role,
        content: item.content.trim().slice(-100),
      })),
      {
        role: "user",
        content: /[\u4e00-\u9fa5]/.test(text)
          ? "请使用中文"
          : "Please use English",
      },
      {
        role: "user",
        content:
          "you need use markdown to reply short and clear and need think more and more and add ``` as markdown code block to write the ngql.",
      },
      {
        role: "user",
        content: systemPrompt,
      },
    ];
    ws.runChat({
      req: {
        stream: true,
        temperature: 0.5,
        max_tokens: 200,
        messages: sendMessages,
      },
      callback: (res) => {
        if (res.message.done) {
          newMessages[newMessages.length - 1].status = "done";
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

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages]);

  function renderContent(message: {
    role: string;
    content: string;
    status?: string;
  }) {
    if (!message.content && message.status === "pending") {
      return <div className={styles.loading}>loading...</div>;
    }
    const gqls = message.content.split(/```([^`]+)```/);
    return gqls.map((item, index) => {
      if (index % 2 === 0) {
        return <p key={index}>{item}</p>;
      } else {
        item = item.replace(/^(\n|ngql|gql|cypher)/g, "").replace(/\n$/g, "");
        if (message.status !== "done") {
          return <code key={index}>{item}</code>;
        }
        return (
          <div key={index} className={styles.codeWrapper}>
            <span
              onClick={() => {
                runNgqlInConsole(item);
              }}
            >
              Run
            </span>
            <CodeMirror
              height="120"
              value={item}
              options={{
                mode: "nebula",
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
      <div className={styles.chatContent} ref={contentRef}>
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
                    {renderContent(item)}
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
        <Button type="primary" size="small" loading={pending} onClick={onSend}>
          Send
        </Button>
      </div>
    </div>
  );
}

export default observer(Chat);
