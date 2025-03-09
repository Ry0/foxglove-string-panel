import { ExtensionContext } from "@foxglove/extension";

import { initExamplePanel } from "./StringPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "String ", initPanel: initExamplePanel });
}
