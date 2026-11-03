import { Route, Switch } from "wouter";
import { Admin, AdminLogin } from "./pages/admin";
import { Provider } from "./components/provider";
import { AgentFeedback } from "@runablehq/website-runtime";
import { publicSiteUrl } from "./lib/site";
function App() {
  return <Provider><Switch>
    <Route path="/admin/login" component={AdminLogin} />
    <Route path="/admin/:section?" component={Admin} />
    <Route><main className="login-screen"><a className="button" href={publicSiteUrl}>Открыть галерею</a></main></Route>
  </Switch>{import.meta.env.DEV && <AgentFeedback />}</Provider>;
}
export default App;
