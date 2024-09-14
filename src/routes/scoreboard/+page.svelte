<svelte:head>
	<title>Scoreboard Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
	<style>
	html, body {
		background: #222222;
	}
	input[type="number"] {
		width: 3rem;
	}
	</style>
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  import { gunWrapper } from '$lib/gun.js';
  import { mqttWrapper } from '$lib/mqtt.js';
  import { websocketWrapper } from '$lib/ws.js';
  import { page } from "$app/stores";

  let team1  = writable("Team 1");
  let team2  = writable("Team 2");
  let score1 = writable("Score 1");
  let score2 = writable("Score 2");
  let show = writable(false);
  
  onMount(function(){
    let wrapStore;
    const options = {
      gun: 'https://gun.filiphanes.sk/gun',
      mqtt: undefined,
      ws: undefined,
      password: $page.url.hash.slice(1) || 'demo',
      path: undefined,
    };
    for (const [key, value] of $page.url.searchParams) {
      options[key] = value;
    }
    options.path = options.path || `scoreboard/${options.password}/`;
    if (options.ws) {
      wrapStore = websocketWrapper(options);
    } else if (options.mqtt) {
      wrapStore = mqttWrapper(options);
    } else if (options.gun) {
      wrapStore = gunWrapper(options)
    }
	team1 = wrapStore('team1', team1);
	team2 = wrapStore('team2', team2);
	score1 = wrapStore('score1', score1);
	score2 = wrapStore('score2', score2);
	show = wrapStore('show', show);
})

  function showBoard() {
    $show = true;
  }
  function hideBoard() {
    $show = false;
  }
</script>
		
<div class="container-fluid my-3">
	<div class="row">
		<div class="col-md">
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Scoreboard control</h5>
					<div class="form-row">
						<div class="form-group col-md-6">
							<label for="team1">Team 1:</label>
							<input class="form-control" type="text" placeholder="Team 1 Name" id="team1" bind:value={team1}>
						</div>
						<div class="form-group col-md-6">
							<label for="team2">Team 2:</label>
							<input class="form-control" type="text" placeholder="Team 2 Name" id="team2" bind:value={team2}>
						</div>
					</div>
					<div class="form-group">
						<p>Score:</p>
						<div class="input-group mb-3">
							<input class="form-control" type="number" id="score1" bind:value={score1}>
							<span class="form-control input-group-text col-1">-</span>
							<input class="form-control" type="number" id="score2" bind:value={score2}>
						</div>
						<small class="form-text text-muted">Team names and Scores are updated automatically on change and show.</small>
					</div>
					<div>
						<button class="btn btn-lg btn-success" on:click={showBoard}>Show</button>
						<button class="btn btn-lg btn-primary" on:click={hideBoard}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<small class="text-muted">The scoreboard animation in this example was made by <a href="http://glowdragon.de" target="_blank">glowdragon.de</a></small>
</div>
