
function uniq(array) { return Array.from(new Set(array)) }
function qs(query, root=document) { return root.querySelector(query) }
function qsa(query, root=document) { return Array.from(root.querySelectorAll(query)) }


/* Scheduling */
function timeIsValid(times) {
	const timeRegex = /^([1-9]|1[012]):[0-5][0-9](a|p)-([1-9]|1[012]):[0-5][0-9](a|p)$/i;
	return times.split(',').every(time => {
		return timeRegex.test(time.trim());
	});

	// TODO: Check that the start time is before the end time.
}


const DAYS = ['su','mo','tu','we','th','fr','sa'];
function checkSchedule(times, days) {
	if (!times || !days) return false;

	const now = new Date();
	const currDay = DAYS[now.getDay()];
	const daysArray = days.split(',').map(d => d.toLowerCase().trim());

	if (!daysArray.includes(currDay)) return false;

	const timesArray = times.split(',').map(t => t.toLowerCase().trim());
	return timesArray.some(time => {
		const [ startString, endString ] = time.split('-');
		const parsedStartTime = parseScheduleTime(startString.trim());
		const parsedEndTime = parseScheduleTime(endString.trim());
		const startTime = timeToday(parsedStartTime);
		const endTime = timeToday(parsedEndTime);
		return now > startTime && now < endTime;
	});
}

function parseScheduleTime(time) {
	const period = time.slice(-1);
	const [ hours, minutes ] = time.slice(0, -1).split(':');
	return { hours, minutes, period };
}

function timeToday({ hours, minutes, period }) {
	const now = new Date();
	const trueHours = Number(hours) + (period === 'p' ? 12 : 0);
	now.setHours(trueHours, minutes, 0, 0);
	return now;
}
