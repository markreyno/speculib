const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("localModels", {
  agentStep: (input, key) => ipcRenderer.invoke("models:agentStep", input, key),
  settings: () => ipcRenderer.invoke("models:settings"),
  list: () => ipcRenderer.invoke("models:list"),
  save: (value) => ipcRenderer.invoke("models:save", value),
  plan: (input, key) => ipcRenderer.invoke("models:plan", input, key),
  classify: (input, key) => ipcRenderer.invoke("models:classify", input, key),
  answer: (input, key) => ipcRenderer.invoke("models:answer", input, key),
  cancel: (key) => ipcRenderer.invoke("models:cancel", key),
});
