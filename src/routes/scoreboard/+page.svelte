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
  import { gun } from '$lib/gun.js';
  import { page } from "$app/stores";

  var overlay = gun.get('scoreboard').get($page.url.hash || 'demo');
  let team1 = "Team 1";
  let team2 = "Team 2";
  let score1 = "Score 1";
  let score2 = "Score 2";
  
  onMount(function(){
    overlay.get('team1').on(function(data, key){team1 = data});
    overlay.get('team2').on(function(data, key){team2 = data});
    overlay.get('score1').on(function(data, key){score1 = data});
    overlay.get('score2').on(function(data, key){score2 = data});
  })

  function show() {
    overlay.get('show').put(true);
  }
  function hide() {
    overlay.get('show').put(false);
  }
  function change(event) {
    overlay.get(event.target.id).put(event.target.value);
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
							<input class="form-control" type="text" placeholder="Team 1 Name" id="team1" bind:value={team1} on:change={change}>
						</div>
						<div class="form-group col-md-6">
							<label for="team2">Team 2:</label>
							<input class="form-control" type="text" placeholder="Team 2 Name" id="team2" bind:value={team2} on:change={change}>
						</div>
					</div>
					<div class="form-group">
						<p>Score:</p>
						<div class="input-group mb-3">
							<input class="form-control" type="number" id="score1" bind:value={score1} on:change={change}>
							<span class="form-control input-group-text col-1">-</span>
							<input class="form-control" type="number" id="score2" bind:value={score2} on:change={change}>
						</div>
						<small class="form-text text-muted">Team names and Scores are updated automatically on change and show.</small>
					</div>
					<div>
						<button class="btn btn-lg btn-success" on:click={show}>Show</button>
						<button class="btn btn-lg btn-primary" on:click={hide}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<small class="text-muted">The scoreboard animation in this example was made by <a href="http://glowdragon.de" target="_blank">glowdragon.de</a></small>
</div>
