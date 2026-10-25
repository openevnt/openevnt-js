# @evnt/convert

Convert between different event formats, using [Open Evnt](https://evnt.directory) 0.2 as the intermediate format.

## Registry pattern

```ts
import { formats } from "@evnt/convert";

// Convert Open Evnt to iCalendar text
const ics = formats.icalendar.to(event);

// Convert Open Evnt to an ActivityStreams object
const as2 = formats.activitystreams.to(event);

// Convert a parsed Schema.org object to Open Evnt
const evnt = formats.schemaOrg.from(JSON.parse(input));

import { hEvent } from "@evnt/convert/h-event";
const evnt2 = hEvent.from(htmlString, { id: "https://example.com/events/42.evnt.json" });
```

Each format has a `to` (OpenEvnt → format) and/or a `from` (format → OpenEvnt), and is typed
`satisfies FormatConverter<TDocument>`: only the directions it has exist on its type. Text formats
(iCalendar, h-event) take and return strings. JSON formats take and return the parsed JSON, so
`JSON.parse` and `JSON.stringify` are the caller's.

## Supported formats

| Key                | Name                          | `.to` | `.from` | Extensions       | Peer dependency |
| ------------------ | ----------------------------- | :---: | :-----: | ---------------- | --------------- |
| `icalendar`        | iCalendar (RFC 5545)          |  ✅   |   ✅    | `.ics`, `.ical`  | `ical.js`       |
| `jcal`             | jCal (RFC 7265)               |  ✅   |   ✅    | `.json`, `.jcal` | `ical.js`       |
| `jscalendar`       | JSCalendar (RFC 8984)         |  ✅   |   ✅    | `.json`          | —               |
| `activitystreams`  | W3C Activity Streams 2.0      |  ✅   |   ✅    | `.json`          | —               |
| `schemaOrg`        | Schema.org JSON-LD Event      |  ✅   |   ✅    | `.json`          | —               |
| `google`           | Google Calendar API           |  ❌   |   ✅    | `.json`          | —               |
| `communityLexicon` | AT Protocol Community Lexicon |  ❌   |   ✅    | `.json`          | —               |
| `hEvent`           | Microformats2 h-event (HTML)  |  ❌   |   ✅    | `.html`, `.htm`  | `htmlparser2`   |

You can import specific formats for tree-shaking:

```ts
import { icalendar, activitystreams } from "@evnt/convert";
import { schemaOrg } from "@evnt/convert/schema-org";
```

## Options

Every `to` and `from` takes the same options:

| Option     | What it is                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `language` | The language of the text a format does not label, and the language to write. `en` by default.                                               |
| `timezone` | The IANA time zone of dates written without one. `UTC` by default.                                                                          |
| `id`       | The `id` of a document read from another format: the https URL it will be served from. Without it, each conversion makes a new `urn:uuid:`. |
| `uid`      | The iCalendar or JSCalendar UID, when it should not be the event's `id`.                                                                    |
| `did`      | The AT Protocol DID that holds the blobs of a community lexicon event's media.                                                              |

Open Evnt has one venue, which is a physical place. Online locations in other formats become link
components.

## Dependencies

Most converters have zero external dependencies. Some require an optional peer dependency:

| Peer dependency | Required by         | Install                |
| --------------- | ------------------- | ---------------------- |
| `ical.js`       | `icalendar`, `jcal` | `pnpm add ical.js`     |
| `htmlparser2`   | `hEvent`            | `pnpm add htmlparser2` |

If you import the main package (not tree-shaking), you may need to install these dependencies even if you don't use the formats that require them.
