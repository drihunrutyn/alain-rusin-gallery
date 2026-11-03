import { Route, Switch } from "wouter";
import Home from "./pages/home";
import { Gallery, ArtworkPage, About, Media, B2B, Privacy, NotFound } from "./pages/public-pages";
import { Layout } from "./components/gallery-ui";
import { PageMetadata } from "./components/page-metadata";
export function PublicApp() {
  return <><PageMetadata /><Layout><Switch>
    <Route path="/" component={Home} />
    <Route path="/gallery" component={Gallery} />
    <Route path="/artwork/:id" component={ArtworkPage} />
    <Route path="/about" component={About} />
    <Route path="/media" component={Media} />
    <Route path="/b2b" component={B2B} />
    <Route path="/privacy" component={Privacy} />
    <Route component={NotFound} />
  </Switch></Layout></>;
}
