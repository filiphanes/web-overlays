<svelte:head>
	<title>Lower Third Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  import { page } from "$app/stores";
  import { makeWrapStore } from '$lib/wrap.js';
  let show  = writable(false);
  let line1 = writable("Text Line 1");
  let line2 = writable("Text Line 2");
		
  onMount(function(){
    const wrapStore = makeWrapStore({
      space: 'lowerthird',
      password: $page.url.hash.slice(1) || 'demo',
      ...Object.fromEntries($page.url.searchParams)
    });
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
						<button class="btn btn-lg btn-success" onclick={()=>{$show=true}}>Show</button>
						<button class="btn btn-lg btn-primary" onclick={()=>{$show=false}}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
