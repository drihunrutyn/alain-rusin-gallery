import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { PublicApp } from "./public-app";
import { PublicDataContext } from "./public-data";
import snapshot from "virtual:gallery-snapshot";
import { routerBase } from "./lib/site";
export function render(route: string) {
  return renderToString(<Router base={routerBase} ssrPath={routerBase + route}><PublicDataContext.Provider value={snapshot}><PublicApp /></PublicDataContext.Provider></Router>);
}
