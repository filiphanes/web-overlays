<script>
  import { onMount, onDestroy } from "svelte";
  import Keypad from "./Keypad.svelte";
  import biblia from "./roh.json";

  let shown = false;
  let line1 = '';
  let line2 = '';
  let bodyclass = '';
  let lastAddresses = [
    {book: "gn", chapter: 1, verse: 1, count: 1},
  ];

  let books = biblia.books;
  let booksByAbbr = new Map();
  books.forEach(book => {booksByAbbr[book.abbreviation] = book});

  let bookFilter = "";
  let aBook;

  let selected = {
    book: "gn",
    chapter: 1,
    verse: 1,
    count: 1
  }
  let shownAddress = selected;

  GUN_SUPER_PEERS = GUN_SUPER_PEERS || ['http://127.0.0.1/gun'];
  let gun = Gun(GUN_SUPER_PEERS);
  let overlay = gun.get('bible').get(window.location.hash || 'demo');
  overlay.get('show').on(function(data, key){shown = data});
  let overlayAddress = overlay.get('address');
  overlayAddress.map().on(function(data, key){shownAddress[key] = data});
  let overlayLine1 = overlay.get('line1');
  let overlayLine2 = overlay.get('line2');
  let overlayBodyClass = overlay.get('bodyclass');
  overlayLine1.on(function(data){line1 = data});
  overlayLine2.on(function(data){line2 = data});

  $: filteredBooks = bookFilter
    ? books.filter(matchesBook)
    : books;
  // $: filteredLastAddresses = bookFilter
  //   ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
  //   : lastAddresses;

  function matchesBook(book) {
    const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      bookLower.startsWith(prefix) ||
      book.abbreviation.startsWith(prefix) ||
      (book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix))) ||
      (prefix.length >= 2 && bookLower.includes(' '+prefix))
    );
  }

  $: aBook = booksByAbbr[shownAddress.book];
  $: selected.count = selected.verse ? selected.count : 1;
  $: overlayAddress.put(selected);
  $: overlayLine1.put(addressAsString(selected));
  $: overlayLine2.put(addressContent(selected));

  function addToLastAddresses(address) {
    lastAddresses.unshift({
      book: address.book,
      chapter: address.chapter,
      verse: address.verse,
      count: address.count
    });
    lastAddresses = lastAddresses.filter((h,i) => i === 0 || !equalAddresses(h, address));
  }

  function addressAsString(address){
    var s = booksByAbbr[address.book].name + ' ' + address.chapter;
    if (address.verse) {
      s += ',' + address.verse;
      if (address.count > 1) {
        s += '-' + (address.verse + address.count - 1);
      }
    }
    return s;
  }

  function addressContent(address){
    var book = booksByAbbr[shownAddress.book];
    var content = '';
    if (book.chapters[selected.chapter] && selected.verse) {
      for (var i=selected.verse; i < selected.verse+selected.count; i++) {
        content += '\n' + (book.chapters[selected.chapter][i-1] || '');
      }
    }
    return content;
  };

  function equalAddresses(a, b) {
    return  a.book == b.book &&
            a.chapter == b.chapter &&
            a.verse == b.verse &&
            a.count == b.count;
  }

  function addressSelector(address) {
    address.chapter = address.chapter || '';
    address.verse = address.verse || '';
    address.count = address.count || 1;
    return function() {selected = address};
  }

  function removeLastAddress(j) {
    return function() {
      lastAddresses = lastAddresses.filter((h, i) => (i !== j));
    }
  }

  function toggleLine() {
    shown = !shown;
    overlay.get('show').put(shown);
    if (shown) {
      addToLastAddresses(selected);
    }
  }
</script>

<style>
  .control-button {
    width: 6rem;
    /* float: right; */
  }
  .books-filter,
  .address-filter {
    display: block;
    width: 49%;
    margin: 0 1% 0 0;
    padding: 0;
    height: 10rem;
    overflow: scroll;
    float: left;
    max-width: 15rem;
  }
  .book-item {
    width: 100%;
    margin: 0 0 .25rem 0;
    padding: .25rem .5rem;
    text-align: left;
  }
  .address-item {
    width: 100%;
    margin: 0 0 .25rem 0;
    max-width: 30rem;
  }
  .address-set {
    width: auto;
    padding: .25rem .5rem;
    margin: 0;
    text-align: left;
  }
  .address-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
  }
  .vers,
  .address {
    color: white;
  }
  :global(body) {
    color: white;
  }
  button {
    margin: 0;
    line-height: 2rem;
    width: 2.8rem;
  }
</style>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} />
  <button type="button" class="form-control btn btn-secondary" on:click={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as book}
  <button class="book-item btn" class:btn-primary={book.abbreviation==shownAddress.book} on:click={addressSelector({book: book.abbreviation})}>{book.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each lastAddresses as address, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(address, shownAddress)} on:click={addressSelector(address)}>{addressAsString(address)}</button>
    <button class="btn address-remove" on:click={removeLastAddress(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: 0 .5rem 0 0;">
  Kapitola: {selected.chapter}
  <Keypad bind:value={selected.chapter} max={Object.keys(aBook.chapters).length} />
  <button class="control-button btn" on:click={toggleLine} class:btn-danger={shown} class:btn-success={!shown}>
    {#if shown}Skryť{:else}Zobraziť{/if}
  </button>
</div>
<div style="display: inline-block;">
  Od verša: {selected.verse}
  <Keypad bind:value={selected.verse} max={(aBook.chapters[selected.chapter]||[]).length} />
  <button class="btn btn-primary" on:click={function(){selected.count -= 1}}
          disabled={selected.count <= 1}>-1</button>
  <button class="btn btn-primary" on:click={function(){selected.count += 1}}
          disabled={selected.verse+selected.count > (aBook.chapters[selected.chapter]||[]).length}>+1</button>
  do {selected.verse + selected.count - 1}
</div>

<div class="address">{line1}</div>
<span class="vers">{@html line2}</span>

<div class="bodyclass">
  Téma: {bodyclass}
  <select bind:value={bodyclass} on:change="{() => overlayBodyClass.put(bodyclass)}">
    <option value="" selected>Jednoduché písmo</option>
    <option value="fullscreen-white-bg">Fulscreen biele pozadie</option>
  </div>
