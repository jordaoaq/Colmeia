import React from "react";
import RootNavigator from "./navigation/AppNavigator";
import { registerRootComponent } from "expo";

// O ponto de entrada do app agora é o RootNavigator,
// que gerencia a autenticação e as telas.
function App() {
  return <RootNavigator />;
}

// Garantir que o root seja registrado corretamente (resolve "main has not been registered")
registerRootComponent(App);

export default App;
