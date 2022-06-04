<script>
  import { createEventDispatcher } from "svelte";

  export let value = "";
  export let max = 99999999;

  const dispatch = createEventDispatcher();

  function select (num) {
    return () => {
      value = Math.min(+value * 10 + num, max||99999999)
    }
  }
  function clear() {value = ""};
  function backspace() {value = Math.floor(+value / 10) || ''};
</script>

<div class="numberpad">
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

<style>
button {
  color: whitesmoke;
  background-color: transparent;
  font-size: 1rem;
  outline: none;
  margin: 0;
  line-height: 2rem;
  width: 3rem;
  border: none;
}

button:active {
  background-color: #ccc;
}

button:hover,
button:focus {
  background-color: #333;
}

.numberpad {
  display: grid;
  grid-template-columns: repeat(3, 3rem);
  grid-template-rows: repeat(4, 3rem);
  grid-gap: 0;
  margin: 0 0 0.5rem 0;
}
</style>