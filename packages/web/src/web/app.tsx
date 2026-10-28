import { Route, Switch } from "wouter";
import Home from "./pages/home";
import { Gallery, ArtworkPage, About, Media, B2B, Privacy, NotFound } from "./pages/public-pages";
import { Admin, AdminLogin } from "./pages/admin";
import { Layout } from "./components/gallery-ui";
import { PageMetadata } from "./components/page-metadata";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <PageMetadata />
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/:section?" component={Admin} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/gallery" component={Gallery} />
              <Route path="/artwork/:id" component={ArtworkPage} />
              <Route path="/about" component={About} />
              <Route path="/media" component={Media} />
              <Route path="/b2b" component={B2B} />
              <Route path="/privacy" component={Privacy} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
