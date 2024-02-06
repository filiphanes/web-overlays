<svelte:head>
	<title>Lower Third Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  import { Gun, wrapStore } from '$lib/gun.js';
  import { page } from "$app/stores";
  let showStore = writable(false);
  let line1 = writable("Text Line 1");
  let line2 = writable("Text Line 2");
		
  onMount(function(){
    const gun = Gun([
        'https://gun.filiphanes.sk/gun',
    ])
    let overlay = gun.get('scoreboard').get($page.url.hash || 'demo');
    showStore = wrapStore(overlay.get('show'), showStore);
    line1 = wrapStore(overlay.get('line1'), line1);
    line2 = wrapStore(overlay.get('line2'), line2);
  });
	
  function show() {
    $showStore = true;
  }
  function hide() {
    $showStore = false;
  }
  </script>

<div class="container-fluid">
	<div class="row">
		<div class="col-md">
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Lower Third control</h5>
					<div class="form-group">
						<input class="form-control" type="text" id="line1" bind:value={$line1}>
						<input class="form-control" type="text" id="line2" bind:value={$line2}>
					</div>
					<div>
						<button class="btn btn-lg btn-success" on:click={show}>Show</button>
						<button class="btn btn-lg btn-primary" on:click={hide}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
