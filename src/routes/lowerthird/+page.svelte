<svelte:head>
	<title>Lower Third Controller</title>
	<link rel="stylesheet" href="../css/bootstrap.min.css">
</svelte:head>

<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { multiBrokerState } from '$lib/broker.svelte.js';
  const s = multiBrokerState({
	show: false,
	line1: "Text Line 1",
	line2: "Text Line 2",
  })
		
  onMount(function(){
    s.connect({
      space: 'lowerthird',
      password: $page.url.hash.slice(1) || 'demo',
      ...Object.fromEntries($page.url.searchParams)
    });
  });
</script>

<div class="container-fluid">
	<div class="row">
		<div class="col-md">
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Lower Third control</h5>
					<div class="form-group">
						<input class="form-control" type="text" id="line1" bind:value={s.line1}>
						<input class="form-control" type="text" id="line2" bind:value={s.line2}>
					</div>
					<div>
						<button class="btn btn-lg btn-success" onclick={()=>{s.show=true}}>Show</button>
						<button class="btn btn-lg btn-primary" onclick={()=>{s.show=false}}>Hide</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
