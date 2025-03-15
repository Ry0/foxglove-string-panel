import { PanelExtensionContext, Topic, MessageEvent, SettingsTreeAction } from "@foxglove/extension";
import { useLayoutEffect, useEffect, useState, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { produce } from "immer";
import { set } from "lodash";

// String message type
type StringMessage = {
  data: string;
};

type StringMessageEvent = MessageEvent<StringMessage>;

type PanelState = {
  data: {
    label: string;
    topic?: string;
    visible: boolean;
  };
  appearance: {
    fontSize: number;
    backgroundColor: string;
    fontColor: string;
    fontFamily: string;
  };
};

// 日本語表示に適したクロスプラットフォームフォントの選択肢
const fontOptions = [
  // 日本語フォントファミリー（OS共通のフォールバック設定を含む）
  { value: "'Noto Sans JP', 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif", label: "sans-serif" },
  { value: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif", label: "serif" },
  
  // モノスペースフォント（コードやテキスト表示に適した）
  { value: "'Source Code Pro', 'Consolas', 'Courier New', monospace", label: "monospace" },
  
  // 英語フォントのサンセリフ系（日本語フォールバック付き）
  { value: "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif", label: "Helvetica" },
  { value: "'Segoe UI', 'Yu Gothic UI', 'Meiryo UI', sans-serif", label: "Segoe UI" },
  { value: "'Roboto', 'Noto Sans JP', sans-serif", label: "Roboto" },
  
  // 英語フォントのセリフ系（日本語フォールバック付き）
  { value: "'Times New Roman', 'YuMincho', 'Hiragino Mincho ProN', serif", label: "Times" },
  { value: "'Georgia', 'YuMincho', 'Hiragino Mincho ProN', serif", label: "Georgia" },
];

function StringPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [message, setMessage] = useState<StringMessageEvent>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Restore our state from the layout via the context.initialState property.
  const [state, setState] = useState<PanelState>(() => {
    const initialState = context.initialState as Partial<PanelState>;
    return { 
      data: {
        label: initialState?.data?.label ?? "String Data",
        topic: initialState?.data?.topic,
        visible: initialState?.data?.visible ?? true,
      },
      appearance: {
        fontSize: initialState?.appearance?.fontSize ?? 14,
        backgroundColor: initialState?.appearance?.backgroundColor ?? "#f9f9f9",
        fontColor: initialState?.appearance?.fontColor ?? "#000000",
        // 日本語対応フォントをデフォルトに設定
        fontFamily: initialState?.appearance?.fontFamily ?? "'Noto Sans JP', 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif"
      }
    };
  });

  // Filter all of our topics to find the ones with a String message.
  const stringTopics = useMemo(
    () => (topics ?? []).filter((topic) =>
      topic.schemaName === "std_msgs/msg/String" || 
      topic.schemaName === "std_msgs/String"
    ),
    [topics],
  );

  // Respond to actions from the settings editor to update our state.
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        // Use immer and lodash to produce a new state object
        setState(produce((draft) => set(draft, path, value)));

        // If the topic was changed update our subscriptions.
        if (path[1] === "topic") {
          context.subscribe([{ topic: value as string }]);
        }
      }
    },
    [context],
  );

  // Update the settings editor when state or available topics change
  useEffect(() => {
    context.saveState(state);

    const topicOptions = stringTopics.map((topic) => ({ value: topic.name, label: topic.name }));

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        data: {
          label: state.data.label,
          renamable: true,
          visible: state.data.visible,
          icon: "Cube",
          fields: {
            topic: {
              label: "Topic",
              input: "select",
              options: topicOptions,
              value: state.data.topic,
            },
          },
        },
        appearance: {
          label: "Appearance",
          icon: "Shapes",
          fields: {
            fontSize: {
              label: "Font Size",
              input: "number",
              min: 8,
              max: 32,
              step: 1,
              value: state.appearance.fontSize,
            },
            fontFamily: {
              label: "Font",
              input: "select",
              options: fontOptions,
              value: state.appearance.fontFamily,
            },
            fontColor: {
              label: "Font Color",
              input: "string",
              value: state.appearance.fontColor,
            },
            backgroundColor: {
              label: "Background Color",
              input: "string",
              value: state.appearance.backgroundColor,
            },
          },
        },
      },
    });
  }, [context, actionHandler, state, stringTopics]);

  useEffect(() => {
    if (state.data.topic) {
      // Subscribe to the new string topic when a new topic is chosen.
      context.subscribe([{ topic: state.data.topic }]);
    }
  }, [context, state.data.topic]);

  // Choose our first available string topic as a default once we have a list of topics available.
  useEffect(() => {
    if (state.data.topic == undefined && stringTopics.length > 0) {
      setState(produce((draft) => {
        draft.data.topic = stringTopics[0]?.name;
      }));
    }
  }, [state.data.topic, stringTopics]);

  // Setup our onRender function and start watching topics and currentFrame for messages.
  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics);

      // Save the most recent message on our string topic.
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setMessage(renderState.currentFrame[renderState.currentFrame.length - 1] as StringMessageEvent);
      }
    };

    context.watch("topics");
    context.watch("currentFrame");
  }, [context]);

  // Call our done function at the end of each render.
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <h2>{state.data.topic ?? "Choose a topic in settings"}</h2>
      
      <div 
        style={{ 
          border: "1px solid #ccc", 
          borderRadius: "4px", 
          padding: "1rem", 
          minHeight: "100px",
          maxHeight: "400px",
          overflowY: "auto",
          backgroundColor: state.appearance.backgroundColor,
          fontFamily: state.appearance.fontFamily,
          color: state.appearance.fontColor,
          fontSize: `${state.appearance.fontSize}px`,
          lineHeight: "1.5", // 日本語表示に適した行間
          wordBreak: "break-word" // 長い日本語テキストの折り返し
        }}
      >
        {message ? message.message.data : "No message received yet"}
      </div>
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);

  root.render(<StringPanel context={context} />);

  // Return a function to run when the panel is removed
  return () => {
    root.unmount();
  };
}