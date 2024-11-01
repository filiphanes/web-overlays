<script>
  let {
    value = $bindable(""),
    max = 99999999,
  } = $props();

  function select(num) {
    return () => {
      value = Math.min(+value * 10 + num, max||99999999)
    }
  }
  function clear() {value = ""};
  function backspace() {value = Math.floor(+value / 10) || ''};
</script>

<div class="numberpad">
  <button class="btn btn-primary" onkeyup={select(1)} onclick={select(1)}>1</button>
  <button class="btn btn-primary" onkeyup={select(2)} onclick={select(2)}>2</button>
  <button class="btn btn-primary" onkeyup={select(3)} onclick={select(3)}>3</button>

  <button class="btn btn-primary" onkeyup={select(4)} onclick={select(4)}>4</button>
  <button class="btn btn-primary" onkeyup={select(5)} onclick={select(5)}>5</button>
  <button class="btn btn-primary" onkeyup={select(6)} onclick={select(6)}>6</button>

  <button class="btn btn-primary" onkeyup={select(7)} onclick={select(7)}>7</button>
  <button class="btn btn-primary" onkeyup={select(8)} onclick={select(8)}>8</button>
  <button class="btn btn-primary" onkeyup={select(9)} onclick={select(9)}>9</button>

  <button class="btn btn-primary" onkeyup={backspace} onclick={backspace} disabled={!value}>←</button>
  <button class="btn btn-primary" onkeyup={select(0)} onclick={select(0)}>0</button>
  <button class="btn btn-primary" onkeyup={clear} onclick={clear} disabled={!value} >C</button>
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