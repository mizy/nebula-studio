import {
  Button,
  Radio,
  Form,
  Input,
  Modal,
  Popover,
  Tooltip,
  Checkbox,
  Tabs,
  Switch,
  InputNumber,
} from "antd";
import styles from "./index.module.less";
import Chat from "./chat";
import { useEffect, useState } from "react";
import { post } from "@app/utils/http";
import Icon from "@app/components/Icon";
import { SettingOutlined } from "@ant-design/icons";
import gpt from "@app/stores/gpt";
import { observer } from "mobx-react-lite";
import rootStore from "@app/stores";
// float gpt bot window
function GPTBot() {
  const [open, setVisible] = useState(false);
  const onSetting = () => {
    setVisible(true);
  };
  const gpt = rootStore.gpt;
  return (
    <>
      <Popover
        zIndex={999}
        placement="topLeft"
        content={<Chat />}
        title={
          <div className={styles.gptBotTitle}>
            <div className={styles.gptBotTitleInner}>
              GPT{" "}
              <Tooltip
                title={
                  <p>
                    check text2cypher mode to generate a 'match' cypher query
                    only, and don't send history message to gpt
                    <br />
                    you can ask with "use match" to specify the query ngql type
                    for better result
                  </p>
                }
              >
                <Icon type="icon-studio-nav-help" />
              </Tooltip>
            </div>
            <div className={styles.gptBotHandler}>
              text2cypher
              <Switch
                style={{ margin: "0 5px" }}
                onChange={(checked) => {
                  gpt.update({
                    mode: checked ? "text2cypher" : "text2ngql",
                  });
                }}
                checked={gpt.mode == "text2cypher"}
              />
              <Button
                size={"small"}
                onClick={onSetting}
                icon={<SettingOutlined />}
              ></Button>
            </div>
          </div>
        }
        trigger={"click"}
      >
        <div className={styles.gptBot}>
          <Ball />
        </div>
      </Popover>
      <Setting open={open} setVisible={setVisible} />
    </>
  );
}

function Ball() {
  return (
    <div className={styles.ball}>
      <div className={styles.inner}>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}

function Setting({ open, setVisible }) {
  const [form] = Form.useForm();
  const onClose = () => {
    setVisible(false);
  };
  const onOk = async () => {
    const values = await form.validateFields();
    const res = await post("/api/config/gpt")(values);
    if (res.code === 0) {
      setVisible(false);
      gpt.setConfig(values);
    }
  };

  useEffect(() => {
    if (!open) return;
    initForm();
  }, [open, form]);

  async function initForm() {
    const config = await gpt.fetchConfig();
    form.setFieldsValue(config);
  }
  return (
    <Modal
      title="GPT Config"
      zIndex={1001}
      open={open}
      onOk={onOk}
      onCancel={onClose}
    >
      <Form
        form={form}
        initialValues={{
          url: "https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}",
          apiType: "gpt3.5-turbo",
          gptVersion: "azure",
          features: "spaceSchema",
        }}
      >
        <Form.Item
          name="url"
          help={"please use chat completions api"}
          required
          label="GPT API URL"
        >
          <Input />
        </Form.Item>
        <Form.Item name="key" required label="GPT API Key">
          <Input type="password" />
        </Form.Item>
        <Form.Item name="gptVersion" required label="GPT API Type">
          <Radio.Group>
            <Radio value="azure">azure</Radio>
            <Radio value="openai">openai</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="apiType" required label="GPT Model Version">
          <Radio.Group>
            <Radio value="gpt3.5-turbo">gpt3.5-turbo</Radio>
            <Radio value="gpt4">gpt4</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="features" required label="Features">
          <Checkbox.Group>
            <Checkbox value="spaceSchema">use space schema</Checkbox>
            <Checkbox value="useConsoleNGQL">use console ngql</Checkbox>
          </Checkbox.Group>
        </Form.Item>
        <Form.Item name="docLength" required label="doc length">
          <InputNumber defaultValue={gpt.config.docLength || 500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
export default observer(GPTBot);
