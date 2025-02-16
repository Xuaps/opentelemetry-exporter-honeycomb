/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { diag } from "@opentelemetry/api";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";

import * as Libhoney from "libhoney";
import * as honeyTypes from "./types";
import { HoneyOptions } from "./types/libhoney";

type _response = {
  status_code: number;
  duration: number;
  metadata: object;
  error?: any;
};

/**
 * Prepares send function that will send spans to the remote Zipkin service.
 */
export function prepareSend(
  dataset: string,
  writeKey: string,
  apiHost?: string
) {
  let options: HoneyOptions = {
    writeKey: writeKey,
    dataset: dataset
  };
  if (apiHost) {
    options.apiHost = apiHost;
  }

  const hny = new Libhoney({
    ...options,
    responseCallback: (responses: _response[]) => {
      responses.forEach((resp: _response) => {
        if (resp.error) {
          diag.error(resp.error);
        }
      });
    }
  });
  /**
   * Send spans to the remote Zipkin service.
   */
  return function send(
    events: honeyTypes.Span[],
    done: (result: ExportResult) => void
  ) {
    if (events.length === 0) {
      diag.debug("Honeycomb send with empty spans");
      return done({ code: ExportResultCode.SUCCESS });
    }
    for (let event of events) {
      let ev = hny.newEvent();
      for (let key in event) {
        ev.addField(key, event[key]);
      }
      ev.timestamp = event.timestamp;
      ev.send();
    }
  };
}
