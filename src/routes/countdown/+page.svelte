<script>
	import { onMount } from 'svelte';

	let time = new Date();
	let hours = 0;
	let minutes = 0;
	let seconds = 0;
	let millis = 0;
	let H = 0;
	let M = 1;
	let S = 0;
  let config = {
      countDown: "420",
      showSeconds: "1",
      showHours: "",
      showCircleClock: "",
      digiClockColor: "#FFFFFF",
      digiClockColorNegative: "#FF0000",
      digiClockSize: "50",
      circleClockSize: "50",
      note: "",
  };
	let isNegative = false;
	let countDownTo = +time + +config.countDown * 1000;
	let digiClock = {style:{}};
	let circleClock = {style:{}};
	let configBar = {style:{}};

	onMount(() => {
    const params = new URLSearchParams((window.location.hash || "").slice(1));
    params.forEach((value, key) => {
      if (config[key] !== undefined) {
        config[key] = value;
      }
    });

    countDownTo = new Date(+time + +config.countDown * 1000);
    updateClock();

    updateHash = () => {
      config.showSeconds = config.showSeconds ? "1" : "";
      config.showCircleClock = config.showCircleClock ? "1" : "";
      config.twentyFourHours = config.twentyFourHours ? "1" : "";
      window.location.hash = new URLSearchParams(Object.entries(config)).toString()
    };

		const interval = setInterval(function(){time = new Date()}, 1000);
		return () => {
			clearInterval(interval);
		};
	});

  $: digiClock.style.color = isNegative ? config.digiClockColorNegative : config.digiClockColor;
  $: digiClock.style.fontSize = `${config.digiClockSize}vh`;
  $: circleClock = circleClock || {style:{}};
  $: circleClock.style.maxWidth = `${config.circleClockSize}vw`;
  $: circleClock.style.maxHeight = `${config.circleClockSize}vh`;
  $: configBar.style.display = config.showConfig ? 'block' : 'none';
  $: updateClock(time);
  $: updateHash(config);

  function updateHash() {}

  function handleClick() {
    config.showConfig = !config.showConfig;
  }

  function updateClock() {
    if (time.getHours() != hours) {
      hours = time.getHours();
    }
    if (time.getMinutes() != minutes) {
      minutes = time.getMinutes();
    }
    if (time.getSeconds() != seconds) {
      seconds = time.getSeconds();
    }

    S = Math.floor((countDownTo - +time)/1000);
    isNegative = S < 0;
    if (isNegative) {
      S = -S;
      digiClock.style.color = config.digiClockColorNegative;
    }
    H = Math.floor(S / 3600);
    S -= H * 3600;
    M = Math.floor(S / 60);
    S -= M * 60;
  }

  function changeCountDown(event) {
    config.countDown = parseFloat(event.target.value);
    countDownTo = new Date(+time + +config.countDown * 1000);
    event.target.value = "";
    updateClock();
  }
 </script>

<svelte:head>
	<title>Countdown {config.countDown} s</title>
</svelte:head>

<div class="container" on:click={handleClick}>
<span class="digital-clock" bind:this={digiClock}>
    {#if isNegative}-{/if}{#if config.showHours}{H}:{/if}{#if M<10}0{/if}{M}{#if config.showSeconds}:{#if S<10}0{/if}{S}{/if}
</span>
{#if config.showCircleClock}
<svg viewBox='-50 -50 100 100' bind:this={circleClock}>
	<circle class='clock-face' r='48'/>
	<!-- markers -->
	{#each [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as minute}
		<line class='major' y1='35' y2='45'
			transform='rotate({30 * minute})' />
		{#each [1, 2, 3, 4] as offset}
        <line class='minor' y1='42' y2='45'
            transform='rotate({6 * (minute + offset)})' />
		{/each}
	{/each}
	<!-- hour hand -->
	<line class='hour' y1='2' y2='-20'
		transform='rotate({30 * hours + minutes / 2})' />
	<!-- minute hand -->
	<line class='minute'
		y1='4' y2='-30'
		transform='rotate({6 * minutes + seconds / 10})' />
	<!-- second hand -->
	<g transform='rotate({6 * (seconds + millis/1000)})'>
		<line class='second' y1='10' y2='-38'/>
		<line class='second-counterweight' y1='10' y2='2' />
	</g>
</svg>
{/if}
{#if config.note.trim()}
<div class="note">{config.note}</div>
{/if}
</div>

<div class="config" bind:this={configBar}>
  <label>Time: <select size="1" on:change={changeCountDown}>
    <option value="" selected="selected"></option>
    <option value="30">0:30</option>
    <option value="60">1:00</option>
    <option value="120">2:00</option>
    <option value="180">3:00</option>
    <option value="240">4:00</option>
    <option value="300">5:00</option>
    <option value="360">6:00</option>
    <option value="420">7:00</option>
    <option value="480">8:00</option>
    <option value="540">9:00</option>
    <option value="600">10:00</option>
    <option value="900">15:00</option>
    <option value="1800">30:00</option>
    <option value="2700">45:00</option>
    <option value="3600">1:00:00</option>
    <option value="5400">1:30:00</option>
    <option value="7200">2:00:00</option>
  </select></label>

  <label>Size: <input type="range" min="1" max="100" bind:value={config.digiClockSize}></label>
  <label>Color: <input type="color" bind:value={config.digiClockColor }></label>
  <label>Negative: <input type="color" bind:value={config.digiClockColorNegative }></label>
  <label><input type="checkbox" bind:checked={config.showHours}>Show hours</label>
  <label><input type="checkbox" bind:checked={config.showSeconds}>Show seconds</label>
  <label><input type="checkbox" bind:checked={config.showCircleClock}>Show clock</label>
  {#if config.showCircleClock}
  <label>Size:<input type="range" min="1" max="100" bind:value={config.circleClockSize}></label>
  {/if}

  <label>Note: <input type="input" bind:value={config.note}></label>
  <a href="/clock/" style="color:#ccf">clock</a>
</div>

<style>
.config {
  display: none;
  position: absolute;
  width: 100%;
  padding: .5rem 0;
  top: 0;
  left: 0;
  color: #999;
  background: rgba(80, 80, 80, .5);
  align-items: center;
  justify-content: space-evenly;
}

.digital-clock {
  color: white;
  /* font-family: "7segment"; */
  font-size: 30vh;
  font-weight: 100;
  text-align: center;
}
.note {
  font-family: 'Segoe UI', Tahoma, Verdana, sans-serif;
  font-size: 10vh;
  color: white;
  width: 100%;
  display: block;
  text-align: center;
}
svg {
  max-width: 50vw;
  max-height: 50vh;
}
svg .clock-face {
  stroke: #333;
  fill: black;
}
svg .minor {
  stroke: #999;
  stroke-width: 0.5;
}
svg .major {
  stroke: #999;
  stroke-width: 1;
}
svg .hour {
  stroke: #999;
}
svg .minute {
  stroke: #fff;
}
svg .second, .second-counterweight {
  stroke: rgb(180,0,0);
}
svg .second-counterweight {
  stroke-width: 2;
}

.container {
  display: flex;
  align-items: center;
  height: 100vh;
  flex-wrap: wrap;
  justify-content: space-evenly;
}
input {
  vertical-align: middle;
  background-color: #999;
  border: 0;
}
label {
  margin-right: 1rem;
}
</style>