
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
function checkSchedule(times, days, now=new Date()) {
	if (!times || !days) return false;

	const currDay = DAYS[now.getDay()];
	const daysArray = days.split(',').map(d => d.toLowerCase().trim());

	if (!daysArray.includes(currDay)) return false;

	const timesArray = times.split(',').map(t => t.toLowerCase().trim());
	const matchFound = timesArray.some(time => {
		const [ startString, endString ] = time.split('-');
		const startTime = parseScheduleTime(startString.trim(), now);

		// TODO -> force endTime to come after startTime
		const endTime = parseScheduleTime(endString.trim(), now);

		return now > startTime && now < endTime;
	});

	return matchFound;
}


function parseScheduleTime(time, now) {
	if (!time || !now) return;

	const period = time.slice(-1);
	const [ hours, minutes ] = time.slice(0, -1).split(':');

	const hoursNum = Number(hours);
	let trueHours;
	if (hoursNum === 12 && period === 'a') {
		trueHours = 0;
	} else if (hoursNum === 12 && period === 'p') {
		trueHours = 12;
	} else if (period === 'p') {
	 trueHours = hoursNum + 12;
	} else {
		trueHours = hoursNum;
	}

	const timeInDay = new Date(now).setHours(trueHours, minutes, 0, 0);
	return timeInDay;
}


function nextScheduleChange(times, days) {
	if (!times || !days) return;

	const current = checkSchedule(times, days);
	const SEC_IN_WEEK = 10_080;
	let testDate = new Date();
	testDate.setSeconds(0);
	let next = checkSchedule(times, days, testDate);
	let i = 0;
	while (current === next && i < SEC_IN_WEEK) {
		i += 1;
		testDate = new Date(testDate.getTime() + 60_000);
		next = checkSchedule(times, days, testDate);
	}

	if (i > SEC_IN_WEEK) return;

	return testDate;
}


function formatDateMessage(date) {
	if (!date) return 'unknown date';
	return date.toLocaleDateString('en-us', {
		weekday:"long",
		month:"long",
		hour12: true,
		day:"numeric",
		hour: "numeric",
		minute: "numeric",
	});
}


function formatDateMessageShort(date) {
	if (!date) return 'unknown date';
	return date.toLocaleDateString('en-us', {
		hour: "numeric",
		minute: "numeric",
	}).match(/[0-9]{1,2}:[0-9]{1,2}.*/)[0].toLowerCase();
}


function parseTimeRemaining(ms) {
	const seconds = Math.floor((ms / (1000)) % 60);
	const minutes = Math.floor((ms / (60 * 1000)) % 60);
	const hours = Math.floor((ms / (60 * 60 * 1000)) % 24);
	const days = Math.floor(ms / (60 * 60 * 24 * 1000) % 7);

	return { days, hours, minutes, seconds };
}


function hydrateDropdown(
	root,
	dropdown,
	show = d => d.toggleAttribute('hidden', false),
	hide = d => d.toggleAttribute('hidden', true)
) {

	function clickListener(e) {
	  show(dropdown);
	  root.removeEventListener('click', clickListener);
	  const { right, bottom } = root.getBoundingClientRect();
	  const { width } = dropdown.getBoundingClientRect();
	  dropdown.style.left = (right - width) + 'px';
	  dropdown.style.top = (5 + bottom) + 'px';
	  function hide1(e) {
	    document.removeEventListener('mousedown', hide1);
	    function hide2(e) {
	      document.removeEventListener('mousedown', hide1);
	      document.removeEventListener('mouseup', hide2);
	      setTimeout(() => {
	        hide(dropdown);
	        root.addEventListener('click', clickListener);
	      }, 50);
	    }
	    document.addEventListener('mouseup', hide2);
	  };
	  document.addEventListener('mousedown', hide1);
	}
	root.addEventListener('click', clickListener);
}


function generateRandomString(length) {
  const characters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

