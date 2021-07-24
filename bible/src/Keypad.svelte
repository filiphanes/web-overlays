<script>
  import { createEventDispatcher } from "svelte";

  export let value = "";
  export let max = 99999999;

  const dispatch = createEventDispatcher();

  const select = num => () => {value = Math.min(+value * 10 + num, max||99999999)};
  const clear = () => {value = ""};
  const backspace = () => {value = Math.floor(+value / 10) || ''};
</script>

<div class="keypad">
  <button class="btn btn-primary" on:click={select(1)}>1</button>
  <button class="btn btn-primary" on:click={select(2)}>2</button>
  <button class="btn btn-primary" on:click={select(3)}>3</button>

  <button class="btn btn-primary" on:click={select(4)}>4</button>
  <button class="btn btn-primary" on:click={select(5)}>5</button>
  <button class="btn btn-primary" on:click={select(6)}>6</button>

  <button class="btn btn-primary" on:click={select(7)}>7</button>
  <button class="btn btn-primary" on:click={select(8)}>8</button>
  <button class="btn btn-primary" on:click={select(9)}>9</button>

  <button class="btn btn-primary" on:click={backspace} disabled={!value}>←</button>
  <button class="btn btn-primary" on:click={select(0)}>0</button>
  <button class="btn btn-primary" on:click={clear} disabled={!value} >C</button>
</div>
