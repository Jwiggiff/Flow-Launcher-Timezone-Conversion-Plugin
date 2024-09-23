import childProcess from "child_process";
import * as chrono from "chrono-node";
import moment from "moment-timezone";
import ms from "ms";
import { z } from "zod";
import { Flow, JSONRPCResponse } from "./lib/flow";

// The events are the custom events that you define in the flow.on() method.
const events = ["copy_result"] as const;
type Events = (typeof events)[number];

const flow = new Flow<Events>("assets/icon.png");

flow.on("query", (params) => {
	const { input_tz, output_tz } = flow.settings;

	let INPUT_TZ = input_tz || "America/New_York";
	let OUTPUT_TZ = output_tz.split(" ") || ["America/Los_Angeles", "Europe/London", "Universal"];

	const [query] = z.array(z.string()).parse(params);

	let date: moment.Moment = moment();

	if (query) {
		const timestamp = chrono.parse(query, {
			timezone: moment.tz.zone(INPUT_TZ)?.abbr(chrono.parseDate(query)?.getTime() || Date.now()),
		});
		if (timestamp[0]?.start.get("timezoneOffset") != null) {
			INPUT_TZ =
				moment.tz
					.zonesForCountry("US", true)
					.find((z) => z.offset === timestamp[0].start.get("timezoneOffset"))?.name || INPUT_TZ;

			OUTPUT_TZ = [INPUT_TZ, ...OUTPUT_TZ];
		}

		date = moment.tz(timestamp[0]?.date(), INPUT_TZ);
	} else {
		OUTPUT_TZ = [INPUT_TZ, ...OUTPUT_TZ];
	}

	if (date.isValid()) {
		flow.showResult(...getResults(date, OUTPUT_TZ));
		return;
	}

	// Parse through ms
	if (!!query) date = moment.tz(new Date(Date.now() + ms(query)), INPUT_TZ);
	else date = moment.tz(new Date(Date.now()), INPUT_TZ);

	if (date.isValid()) {
		flow.showResult(...getResults(date, OUTPUT_TZ));
		return;
	}

	flow.showResult({
		title: "Invalid input",
	});
});

function getResults(dateTime: moment.Moment, outputTZ: string[]): JSONRPCResponse<Events>[] {
	return outputTZ.map((tz, i) => {
		const date = dateTime.tz(tz);
		return {
			title: date.format("h:mm a"),
			subtitle: tz,
			method: "copy_result",
			parameters: [date.format("h:mm a")],
			score: outputTZ.length - i,
		};
	});
}

const copyToClipboard = (text: string) => childProcess.spawn("clip").stdin?.end(text);
flow.on("copy_result", (params) => {
	const [text] = z.array(z.string()).parse(params);
	copyToClipboard(text);
});

flow.run();
