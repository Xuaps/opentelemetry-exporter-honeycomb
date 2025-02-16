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

import * as assert from "assert";
import * as nock from "nock";
import { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import {
  ExportResult,
  hrTimeToMicroseconds,
  ExportResultCode
} from "@opentelemetry/core";
import * as api from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { HoneycombExporter } from "../src";
import * as zipkinTypes from "../src/types";
import { TraceFlags } from "@opentelemetry/api";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const MICROS_PER_SECS = 1e6;

function getReadableSpan() {
  const startTime = 1566156729709;
  const duration = 2000;
  const readableSpan: ReadableSpan = {
    name: "my-span",
    kind: api.SpanKind.INTERNAL,
    spanContext: () => ({
      traceId: "d4cda95b652f4a1592b449d5929fda1b",
      spanId: "6e0c63257de34c92",
      traceFlags: TraceFlags.NONE
    }),
    startTime: [startTime, 0],
    endTime: [startTime + duration, 0],
    ended: true,
    duration: [duration, 0],
    status: {
      code: api.SpanStatusCode.OK
    },
    attributes: {},
    links: [],
    events: [],
    resource: Resource.empty(),
    instrumentationLibrary: { name: "default", version: "0.0.1" }
  };
  return readableSpan;
}

describe("Honeycomb Exporter - node", () => {
  describe("constructor", () => {
    it("should construct an exporter", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        url: "http://localhost"
      });
      assert.ok(typeof exporter.export === "function");
      assert.ok(typeof exporter.shutdown === "function");
    });
    it("should construct an exporter with url", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        url: "http://localhost"
      });
      assert.ok(typeof exporter.export === "function");
      assert.ok(typeof exporter.shutdown === "function");
    });
    it("should construct an exporter with logger", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        url: "https://my-url"
      });
      assert.ok(typeof exporter.export === "function");
      assert.ok(typeof exporter.shutdown === "function");
    });
    it("should construct an exporter with statusCodeTagName", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        statusCodeTagName: "code",
        url: "https://my-url"
      });
      assert.ok(typeof exporter.export === "function");
      assert.ok(typeof exporter.shutdown === "function");
    });
    it("should construct an exporter with statusDescriptionTagName", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        statusDescriptionTagName: "description",
        url: "https://my-url"
      });
      assert.ok(typeof exporter.export === "function");
      assert.ok(typeof exporter.shutdown === "function");
    });
  });

  describe("export", () => {
    before(() => {
      nock.disableNetConnect();
    });

    after(() => {
      nock.enableNetConnect();
    });

    it("should skip send with empty array", () => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-writekey",
        url: "https://my-url"
      });

      exporter.export([], (result: ExportResult) => {
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
      });
    });

    it("should send spans to Honeycomb backend and return with Success", () => {
      let requestBody: [zipkinTypes.Span];
      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans", (body: [zipkinTypes.Span]) => {
          requestBody = body;
          return true;
        })
        .reply(202);

      const parentSpanId = "5c1c63257de34c67";
      const startTime = 1566156729709;
      const duration = 2000;

      const span1: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.INTERNAL,
        parentSpanId,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {
          key1: "value1",
          key2: "value2"
        },
        links: [],
        events: [
          {
            name: "my-event",
            time: [startTime + 10, 0],
            attributes: { key3: "value3" }
          }
        ],
        resource: Resource.empty(),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };
      const span2: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.SERVER,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {},
        links: [],
        events: [],
        resource: Resource.empty(),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };

      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        writeKey: "my-writekey",
        dataset: "my-dataset",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([span1, span2], (result: ExportResult) => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
        assert.deepStrictEqual(requestBody, [
          // Span 1
          {
            annotations: [
              {
                value: "my-event",
                timestamp: (startTime + 10) * MICROS_PER_SECS
              }
            ],
            duration: duration * MICROS_PER_SECS,
            id: span1.spanContext().spanId,
            localEndpoint: {
              serviceName: "my-service"
            },
            name: span1.name,
            parentId: parentSpanId,
            tags: {
              key1: "value1",
              key2: "value2",
              "ot.status_code": "OK"
            },
            timestamp: startTime * MICROS_PER_SECS,
            traceId: span1.spanContext().traceId
          },
          // Span 2
          {
            duration: duration * MICROS_PER_SECS,
            id: span2.spanContext().spanId,
            kind: "SERVER",
            localEndpoint: {
              serviceName: "my-service"
            },
            name: span2.name,
            tags: {
              "ot.status_code": "OK"
            },
            timestamp: hrTimeToMicroseconds([startTime, 0]),
            traceId: span2.spanContext().traceId
          }
        ]);
      });
    });

    it("should support https protocol", () => {
      const scope = nock("https://localhost:9411")
        .post("/api/v2/spans")
        .reply(200);

      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        url: "https://localhost:9411/api/v2/spans",
        writeKey: "my-writekey",
        dataset: "my-dataset"
      });

      exporter.export([getReadableSpan()], (result: ExportResult) => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.SUCCESS);
      });
    });

    it("should return Failed result with 4xx", () => {
      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans")
        .reply(400);

      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        writeKey: "my-writekey",
        dataset: "my-dataset",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([getReadableSpan()], (result: ExportResult) => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.FAILED);
      });
    });

    it("should return failed result with 5xx", () => {
      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans")
        .reply(500);

      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        writeKey: "my-writekey",
        dataset: "my-dataset",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([getReadableSpan()], (result: ExportResult) => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.FAILED);
      });
    });

    it("should return failed result with socket error", () => {
      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans")
        .replyWithError(new Error("My Socket Error"));

      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-write-key",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([getReadableSpan()], (result: ExportResult) => {
        scope.done();
        assert.strictEqual(result.code, ExportResultCode.FAILED);
      });
    });

    it("should return failed result after shutdown", (done) => {
      const exporter = new HoneycombExporter({
        serviceName: "my-service",
        dataset: "my-dataset",
        writeKey: "my-write-key",
        url: "https://my-url"
      });

      exporter.shutdown();

      exporter.export([getReadableSpan()], (result: ExportResult) => {
        assert.strictEqual(result.code, ExportResultCode.FAILED);
        done();
      });
    });

    it('should set serviceName to "Opentelemetry Service" by default', () => {
      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans")
        .replyWithError(new Error("My Socket Error"));

      const parentSpanId = "5c1c63257de34c67";
      const startTime = 1566156729709;
      const duration = 2000;

      const span1: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.INTERNAL,
        parentSpanId,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {
          key1: "value1",
          key2: "value2"
        },
        links: [],
        events: [
          {
            name: "my-event",
            time: [startTime + 10, 0],
            attributes: { key3: "value3" }
          }
        ],
        resource: Resource.empty(),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };
      const span2: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.SERVER,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {},
        links: [],
        events: [],
        resource: Resource.empty(),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };

      const exporter = new HoneycombExporter({
        writeKey: "test",
        dataset: "test",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([span1, span2], (result: ExportResult) => {
        scope.done();
        assert.equal(exporter["_serviceName"], "OpenTelemetry Service");
      });
    });

    it("should set serviceName if resource has one", () => {
      const resource_service_name = "resource_service_name";

      const scope = nock("http://localhost:9411")
        .post("/api/v2/spans")
        .replyWithError(new Error("My Socket Error"));

      const parentSpanId = "5c1c63257de34c67";
      const startTime = 1566156729709;
      const duration = 2000;

      const span1: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.INTERNAL,
        parentSpanId,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {
          key1: "value1",
          key2: "value2"
        },
        links: [],
        events: [
          {
            name: "my-event",
            time: [startTime + 10, 0],
            attributes: { key3: "value3" }
          }
        ],
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: resource_service_name
        }),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };
      const span2: ReadableSpan = {
        name: "my-span",
        kind: api.SpanKind.SERVER,
        spanContext: () => ({
          traceId: "d4cda95b652f4a1592b449d5929fda1b",
          spanId: "6e0c63257de34c92",
          traceFlags: TraceFlags.NONE
        }),
        startTime: [startTime, 0],
        endTime: [startTime + duration, 0],
        ended: true,
        duration: [duration, 0],
        status: {
          code: api.SpanStatusCode.OK
        },
        attributes: {},
        links: [],
        events: [],
        resource: Resource.empty(),
        instrumentationLibrary: { name: "default", version: "0.0.1" }
      };

      const exporter = new HoneycombExporter({
        writeKey: "writeKey",
        dataset: "dataset",
        url: "http://localhost:9411/api/v2/spans"
      });

      exporter.export([span1, span2], (result: ExportResult) => {
        scope.done();
        assert.equal(exporter["_serviceName"], resource_service_name);

        // checking if service name remains consistent in further exports
        exporter.export([span2], (result: ExportResult) => {
          scope.done();
          assert.equal(exporter["_serviceName"], resource_service_name);
        });
      });

      it("should call globalErrorHandler on error", () => {
        const expectedError = new Error("Whoops");
        const scope = nock("http://localhost:9411")
          .post("/api/v2/spans")
          .replyWithError(expectedError);

        const exporter = new HoneycombExporter({
          serviceName: "my-service",
          writeKey: "my-write-key",
          dataset: "my-dataset",
          url: "http://localhost:9411/api/v2/spans"
        });

        exporter.export([getReadableSpan()], (result: ExportResult) => {
          assert.deepStrictEqual(result.code, ExportResultCode.FAILED);
          assert.deepStrictEqual(result.error, expectedError);
          scope.done();
        });
      });
    });
  });

  describe("shutdown", () => {
    before(() => {
      nock.disableNetConnect();
    });

    after(() => {
      nock.enableNetConnect();
    });
  });
});
