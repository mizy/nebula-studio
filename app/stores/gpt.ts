import { makeAutoObservable } from "mobx";
import schema from "./schema";
import ngqlJson from "../utils/ngql.json";
import { get } from "@app/utils/http";
import rootStore from ".";
import ws from "@app/utils/websocket";
import tck from "../utils/tck";

const urlTransformerMap = {
  "7.general-query-statements/3.go/":
    "general-query-statements/go-from-vertex-to-walk",
  "7.general-query-statements/2.match/":
    "general-query-statements/match|Scan|cypher|pattern",
};
export const matchPrompt = `Generate NebulaGraph query from my question.
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
Question:{query_str}
NebulaGraph Cypher dialect query:`;

export const ngqlDoc = (
  ngqlJson as { url: string; content: string; title: string }[]
)
  .map((item) => {
    if (urlTransformerMap[item.url]) {
      item.url = urlTransformerMap[item.url];
    }
    item.url = item.url.replace(/\d+\./g, "");
    item.content = item.content.replace(/nebula>/g, "");
    return item;
  })
  .filter((item) => {
    return item.url.indexOf("clauses-and-options/") === -1;
  });
export const ngqlMap = ngqlDoc.reduce((acc, item) => {
  acc[item.url] = item;
  return acc;
});
export interface GPTConfig {
  url: string;
  apiType: string;
  gptVersion: string;
  key: string;
  features: string;
  docLength: number;
  enable: boolean;
}
class GPT {
  ngqlMap = ngqlMap;
  config = {
    features: "spaceSchema",
    docLength: 1000,
  } as GPTConfig;
  widget: HTMLSpanElement;
  editor: any;
  mode = "text2ngql" as "text2ngql" | "text2cypher";
  constructor() {
    makeAutoObservable(this, {
      editor: false,
      widget: false,
    });
    this.fetchConfig();
  }

  fetchConfig() {
    return get("/api/config/gpt")().then((res) => {
      if (res.code != 0) return;
      this.setConfig(res.data);
      return res.data;
    });
  }

  setConfig(payload: GPTConfig) {
    this.config = { ...payload, ...this.config };
  }

  update(payload: any) {
    Object.assign(this, payload);
  }

  async getSpaceSchema(space: string) {
    if (!space) return "space is empty";
    if (this.config.features.indexOf("spaceSchema") == -1)
      return "spaceSchema is enabled by user";
    await schema.switchSpace(space);
    await schema.getTagList();
    await schema.getEdgeList();
    const tagList = schema.tagList;
    const edgeList = schema.edgeList;
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
    return `now space: ${space}; tags:\n: ${tagsSchema} \nedges:\n ${edgeTypesSchema} \nspace vid type:"${schema.spaceVidType}"`;
  }

  async getDocPrompt(text: string) {
    let prompt = matchPrompt; // default use text2cypher
    if (
      text.toLowerCase().indexOf("match") === -1 &&
      this.mode !== "text2cypher"
    ) {
      const res = (await ws.runChat({
        req: {
          temperature: 0,
          stream: false,
          max_tokens: 10,
          messages: [
            {
              role: "system",
              content: `the graph database doc with "," splited is below:${tck.categoryString}. give me a top 2 relevant value for the question: "${text}".just give me the value without any prefix words.the value is:`,
            },
          ],
        },
      })) as any;
      if (res.code === 0) {
        const url = res.message.choices[0].message?.content;
        console.log("select doc url:", url);
        const paths = url.replace(" ", "").split(",");
        if (tck.cateogryMap[paths[0]]) {
          let doc = tck.cateogryMap[paths[0]];
          const doc2 = tck.cateogryMap[paths[1]];
          if (doc2) {
            doc = doc.concat(doc2);
          }
          if (doc.length) {
            let docString = "";
            doc.find((item) => {
              if (docString.length > this.config.docLength) return true;
              docString += item + "\n";
            });
            console.log("docString:", docString);
            prompt = `learn the below NGQL, and use it to help user write the ngql,the user space schema is "{schema}" the doc is: \n${docString} the question is "{query_str}"`;
          }
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
      return prompt.replace("{schema}", "no space selected");
    }
    const schemaPrompt = await rootStore.gpt.getSpaceSchema(space);
    prompt = prompt.replace("{schema}", schemaPrompt);
    return prompt;
  }

  timer;
  running = false;
  async checkCopilotList(editor: any) {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      let snippet = "";
      const cm = editor.editor;
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line).split(";").pop();
      if (cursor.ch < line.length - 1) return;
      if (line.length < 3) return;
      const tokens = line.split(" ");
      const firstToken = tokens.find(
        (item) => item.replaceAll(" ", "").length > 0
      );
      const hits = ngqlDoc.filter(
        (item) =>
          item.title.toLowerCase().indexOf(firstToken.toLowerCase()) > -1
      );
      let doc = "";
      if (hits.length) {
        hits.forEach((item) => {
          if (this.mode == "text2cypher" && item.title == "match") {
            doc += matchPrompt;
            return;
          }
          doc += item.title + "\n" + item.content + "\n";
        });
      }
      if (!doc) {
        return;
      }
      this.running = true;
      cm.closeHint();
      const schema = await this.getSpaceSchema(rootStore.console.currentSpace);
      const res = (await ws.runChat({
        req: {
          temperature: 1,
          stream: false,
          max_tokens: 30,
          messages: [
            {
              role: "user",
              content: `As a NebulaGraph NGQL code autocomplete copilot, you have access to the following information: document "${doc.slice(
                0,
                this.config.docLength
              )}" and user space schema "${schema}".
               Use this information to guess the user's next NGQL code autocomplete as accurately as possible.
               Please provide your guess as a response without any prefix words.
               Don't explain anything.
               the next autocomplete text can combine with the given text.
               use space schema to help you write the ngql.
               if you can't guess, say "Sorry",
               if you think the ngql is over, return ";"
               The user's NGQL text is: ${line}
               the next autocomplete text is:`,
            },
          ],
        },
      })) as any;
      if (res.code === 0) {
        snippet = res.message.choices[0].message?.content;
        console.log(snippet);
        if (snippet.indexOf("Sorry") > -1) {
          snippet = "";
        }
      }
      if (snippet) {
        this.inertSnippet(cm, snippet);
      }
      this.running = false;
    }, 1000);
  }

  inertSnippet(cm: any, snippet: string) {
    this.widget?.remove();
    const cursor = cm.getCursor();
    const widget = document.createElement("span");
    widget.style.color = "rgba(0,0,0,.4)";
    widget.innerHTML = snippet;
    widget.style.marginTop = "-16px";
    widget.style.backgroundColor = "#f5f5f5";
    this.widget = widget;
    this.editor = cm;
    cm.addWidget(cursor, widget, false);
    document.addEventListener("keyup", this.removeSnippet);
  }

  removeSnippet = (e?: KeyboardEvent) => {
    document.removeEventListener("keyup", this.removeSnippet);
    if (e && e.key !== "Tab") {
      e.preventDefault();
      this.widget.remove();
      return;
    }
    const cursor = this.editor.getCursor();
    cursor.ch -= 1;
    this.editor.replaceRange(this.widget.innerText, cursor, cursor);
    this.editor.replaceSelection("");
    this.editor = null;
    this.widget.remove();
  };
}

export default new GPT();
