import { hydrateRoot } from "react-dom/client";
import { Router } from "wouter";
import { PublicApp } from "./public-app";
import { PublicDataContext } from "./public-data";
import snapshot from "virtual:gallery-snapshot";
import { routerBase } from "./lib/site";
import "./styles.css";
// Remove the directory-index slash before hydration so the same route matches on both sides.
if (location.pathname.length > 1 && location.pathname.endsWith("/"))
  history.replaceState(null, "", location.pathname.slice(0, -1) + location.search + location.hash);
hydrateRoot(document.getElementById("root")!, <Router base={routerBase}><PublicDataContext.Provider value={snapshot}><PublicApp /></PublicDataContext.Provider></Router>);
