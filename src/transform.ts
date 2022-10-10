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

import { ReadableSpan, TimedEvent } from "@opentelemetry/sdk-trace-base";
import { hrTimeToMicroseconds } from "@opentelemetry/core";
import * as api from "@opentelemetry/api";
import * as honeyTypes from "./types";
import { Resource } from "@opentelemetry/resources";

export const statusCodeTagName = "ot.status_code";
export const statusDescriptionTagName = "ot.status_description";

const HONEYCOMB_SPAN_KIND_MAPPING = {
  [api.SpanKind.CLIENT]: honeyTypes.SpanKind.CLIENT,
  [api.SpanKind.SERVER]: honeyTypes.SpanKind.SERVER,
  [api.SpanKind.CONSUMER]: honeyTypes.SpanKind.CONSUMER,
  [api.SpanKind.PRODUCER]: honeyTypes.SpanKind.PRODUCER,
  // When absent, the span is local.
  [api.SpanKind.INTERNAL]: undefined
};

/**
 * Translate OpenTelemetry ReadableSpan to ZipkinSpan format
 * @param span Span to be translated
 */
export function toEvent(
  span: ReadableSpan,
  serviceName: string,
  statusCodeTagName: string,
  statusErrorTagName: string
): honeyTypes.Span {
  let event: honeyTypes.Span = {
    traceId: span.spanContext().traceId,
    parentId: span.parentSpanId,
    name: span.name,
    id: span.spanContext().spanId,
    kind: HONEYCOMB_SPAN_KIND_MAPPING[span.kind],
    timestamp: hrTimeToMicroseconds(span.startTime),
    duration: hrTimeToMicroseconds(span.duration),
    localEndpoint: { serviceName },
    tags: _toHoneyTags(
      span.attributes,
      span.status,
      statusCodeTagName,
      statusErrorTagName,
      span.resource
    ),
    annotations: span.events.length
      ? _toHoneyAnnotations(span.events)
      : undefined
  };

  return event;
}

export function _toHoneyTags(
  attributes: api.SpanAttributes,
  status: api.SpanStatus,
  statusCodeTagName: string,
  statusErrorTagName: string,
  resource: Resource
): honeyTypes.Tags {
  const tags: { [key: string]: string } = {};
  for (const key of Object.keys(attributes)) {
    tags[key] = String(attributes[key]);
  }
  if (status.code !== api.SpanStatusCode.UNSET) {
    tags[statusCodeTagName] = String(api.SpanStatusCode[status.code]);
  }
  if (status.code === api.SpanStatusCode.ERROR && status.message) {
    tags[statusErrorTagName] = status.message;
  }

  Object.keys(resource.attributes).forEach(
    (name) => (tags[name] = String(resource.attributes[name]))
  );

  return tags;
}

export function _toHoneyAnnotations(
  events: TimedEvent[]
): honeyTypes.Annotation[] {
  return events.map((event) => ({
    timestamp: hrTimeToMicroseconds(event.time),
    value: event.name
  }));
}
