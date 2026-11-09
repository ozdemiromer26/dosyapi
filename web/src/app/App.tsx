import React from "react";
import { buildVals } from "../vm";
import { Root } from "../ui/screens/Root";
import { DocumentController } from "./DocumentController";

export class App extends DocumentController {
  render() {
    return <Root v={buildVals(this)} />;
  }
}
