<script>
	import { onMount } from 'svelte';

	let time = new Date();
	let hours = 0;
	let minutes = 0;
	let seconds = 0;
	let millis = 0;
	let showConfig = false;
	let digiClock = {style:{}};
	let circleClock = {style:{}};
	let configBar = {style:{}};
    let config = {
        showSeconds: "",
        showCircleClock: "1",
        twentyFourHours: "1",
        digiClockColor: "#F0F0F0",
        digiClockSize: "50",
        circleClockSize: "50",
        alertAfter: "",
        note: "",
    };

	onMount(() => {
        const params = new URLSearchParams(window.location.hash.slice(1) || "");
        params.forEach((value, key) => {
            if (config[key] !== undefined) {
                config[key] = value;
            }
        });

        updateHash = (config) => {
            config.showSeconds = config.showSeconds ? "1" : "";
            config.showCircleClock = config.showCircleClock ? "1" : "";
            config.twentyFourHours = config.twentyFourHours ? "1" : "";
            window.location.hash = new URLSearchParams(Object.entries(config)).toString()
        };

        const interval = setInterval(updateClocks, 84); // 84ms ~= 12fps
		return () => {
			clearInterval(interval);
		};
	});

    $: digiClock.style.color = config.digiClockColor;
    $: digiClock.style.fontSize = `${config.digiClockSize}vh`;
    $: circleClock = circleClock || {style:{}};
    $: circleClock.style.maxWidth = `${config.circleClockSize}vw`;
    $: circleClock.style.maxHeight = `${config.circleClockSize}vh`;
    $: configBar.style.display = showConfig ? 'block' : 'none';
    $: updateHash(config);

    function updateHash(config) {}

    function handleClick() {
        showConfig = !showConfig;
    }

    function updateClocks() {
        time = new Date();
        if (time.getHours() != hours) {
            hours = time.getHours();
        }
        if (time.getMinutes() != minutes) {
            minutes = time.getMinutes();
        }
        if (time.getSeconds() != seconds) {
            seconds = time.getSeconds();
        }
        millis = time.getMilliseconds();
    }
</script>

<svelte:head>
	<title>Clock</title>
</svelte:head>

<div class="container" on:click={handleClick}>
<span class="digital-clock" bind:this={digiClock}>
    {hours % (config.twentyFourHours ? 24 : 12)}:{#if minutes<10}0{/if}{minutes}{#if config.showSeconds}:{#if seconds<10}0{/if}{seconds}{/if}
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
    <label>Color: <input type="color" bind:value={config.digiClockColor }></label>
    <label><input type="checkbox" bind:checked={config.showSeconds}>seconds</label>
    <label><input type="checkbox" bind:checked={config.twentyFourHours}>24h</label>
    <label>Size: <input type="range" min="1" max="100" bind:value={config.digiClockSize}></label>

    <label><input type="checkbox" bind:checked={config.showCircleClock}>clock</label>
    {#if config.showCircleClock}
    <label>Size:<input type="range" min="1" max="100" bind:value={config.circleClockSize}></label>
    {/if}
    <label>Note: <input type="input" bind:value={config.note}></label>
    <a href="/countdown/" style="color:#ccf">countdown</a>
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
        /* margin-top: 33vh; */
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