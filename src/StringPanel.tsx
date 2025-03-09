import { PanelExtensionContext, Topic, MessageEvent } from "@foxglove/extension";
import { useLayoutEffect, useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";

// String message type
type StringMessage = {
  data: string;
};

type StringMessageEvent = MessageEvent<StringMessage>;

type PanelState = {
  topic?: string;
  fontSize: number;
};

function StringPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [message, setMessage] = useState<StringMessageEvent>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Restore our state from the layout via the context.initialState property.
  const [state, setState] = useState<PanelState>(() => {
    const initialState = context.initialState as Partial<PanelState>;
    return { 
      topic: initialState?.topic,
      fontSize: initialState?.fontSize ?? 14 // デフォルトのフォントサイズを14pxに設定
    };
  });

  // Filter all of our topics to find the ones with a String message.
  const stringTopics = useMemo(
    () => (topics ?? []).filter((topic) => topic.schemaName === "std_msgs/msg/String"),
    [topics],
  );

  useEffect(() => {
    // Save our state to the layout when the topic or fontSize changes.
    context.saveState({ topic: state.topic, fontSize: state.fontSize });

    if (state.topic) {
      // Subscribe to the new string topic when a new topic is chosen.
      context.subscribe([{ topic: state.topic }]);
    }
  }, [context, state.topic, state.fontSize]);

  // Choose our first available string topic as a default once we have a list of topics available.
  useEffect(() => {
    if (state.topic == undefined) {
      setState((prevState) => ({ ...prevState, topic: stringTopics[0]?.name }));
    }
  }, [state.topic, stringTopics]);

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

  // フォントサイズの変更ハンドラー
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setState((prevState) => ({ ...prevState, fontSize: newSize }));
  };

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <div style={{ paddingBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: "1" }}>
          <label>Choose a topic:</label>
          <select
            value={state.topic}
            onChange={(event) => {
              setState((prevState) => ({ ...prevState, topic: event.target.value }));
            }}
            style={{ flex: 1 }}
          >
            {stringTopics.map((topic) => (
              <option key={topic.name} value={topic.name}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label>Font size: {state.fontSize}px</label>
          <input
            type="range"
            min="8"
            max="32"
            value={state.fontSize}
            onChange={handleFontSizeChange}
            style={{ width: "100px" }}
          />
        </div>
      </div>
      
      <div 
        style={{ 
          border: "1px solid #ccc", 
          borderRadius: "4px", 
          padding: "1rem", 
          minHeight: "100px",
          maxHeight: "400px",
          overflowY: "auto",
          backgroundColor: "#f9f9f9",
          fontFamily: "monospace",
          color: "#000000",
          fontSize: `${state.fontSize}px` // 設定されたフォントサイズを適用
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