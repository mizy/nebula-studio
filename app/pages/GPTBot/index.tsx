import { Button, Radio, Form, Input, Modal, Popover } from 'antd'
import styles from './index.module.less'
import Chat from './chat'
import { useEffect, useState } from 'react'
import { get, post } from '@app/utils/http'
// float gpt bot window
function GPTBot() {
  const [open,setVisible] = useState(false)

  const onSetting = () => {
    setVisible(true)
  }

  return (
    <>
    <Popover zIndex={999} placement="topLeft" content={Chat()} title={
      <div className={styles.gptBotTitle}>
        <div className={styles.gptBotTitleInner}>
          GPT
        </div>
        <Button onClick={onSetting}>Setting</Button>
      </div>
      } trigger={"click"}>
        <div className={styles.gptBot}>
            <Ball />
          </div>
      </Popover>
      <Setting open={open} setVisible={setVisible} />
    </>
  )
}

function Ball() {
  return <div className={styles.ball}>
    <div className={styles.inner}>
      <div ></div>
      <div ></div>
      <div ></div>
      <div ></div>
    </div>
  </div>
}

function Setting({open,setVisible}) {
  const [form] = Form.useForm()
  const onClose = () => {
    setVisible(false)
  }
  const onOk = async () => {
    const values = await form.validateFields();
    const res = await post('/api/config/gpt')(values)
    if (res.code===0) {
      setVisible(false)
    }
  }

  useEffect(() => {
    if(!open) return
    get('/api/config/gpt')().then(res => {
      form.setFieldsValue(res.data)
    })
  }, [open,form])
  return <Modal title="GPT Config" zIndex={1001} open={open} onOk={onOk} onCancel={onClose} >
    <Form form={form} initialValues={{
      url: 'https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}',
      apiType: 'gpt3.5-turbo',
      gptVersion: 'azure',
      }}>
      <Form.Item name="url" help={"please use chat completions api"} required label="GPT API URL">
        <Input />
      </Form.Item> 
      <Form.Item name="key" required label="GPT API Key">
        <Input type='password' />
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
      </Form>
    </Modal>
}
export default GPTBot