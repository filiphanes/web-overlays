<svelte:head>
	<title>Lower Third Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  import { gunWrapper } from '$lib/gun.js';
  import { mqttWrapper } from '$lib/mqtt.js';
  import { websocketWrapper } from '$lib/ws.js';
  import { page } from "$app/stores";
  let show  = writable(false);
  let line1 = writable("Text Line 1");
  let line2 = writable("Text Line 2");
		
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
    options.path = options.path || `lowerthird/${options.password}/`;
    if (options.ws) {
      wrapStore = websocketWrapper(options);
    } else if (options.mqtt) {
      wrapStore = mqttWrapper(options);
    } else if (options.gun) {
      wrapStore = gunWrapper(options)
    }
    show  = wrapStore('show', show);
    line1 = wrapStore('line1', line1);
    line2 = wrapStore('line2', line2);
  });
	
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
						<button class="btn btn-lg btn-success" on:click={()=>{$show=true}}>Show</button>
						<button class="btn btn-lg btn-primary" on:click={()=>{$show=false}}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
