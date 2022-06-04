<svelte:head>
	<title>Lower Third Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { gun } from '$lib/gun.js';
  import { page } from "$app/stores";
	let overlay = gun.get('scoreboard').get($page.url.hash || 'demo');
  let line1 = "Text Line 1";
  let line2 = "Text Line 2"
		
  onMount(function(){
		overlay.get('line1').on(function(data, key){line1 = data});
		overlay.get('line2').on(function(data, key){line2 = data});
  });
	
	function show() {
    overlay.get('show').put(true)
  }
	function hide() {
    overlay.get('show').put(false)
  }
	function change(event) {
    overlay.get(event.target.id).put(element.target.value);
  }
  </script>

<div class="container-fluid">
	<div class="row">
		<div class="col-md">
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Lower Third control</h5>
					<div class="form-group">
						<input class="form-control" type="text" id="line1" bind:value={line1} on:change={change}>
						<input class="form-control" type="text" id="line2" bind:value={line2} on:change={change}>
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
