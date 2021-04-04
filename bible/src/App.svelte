<script>
  import { onMount, onDestroy } from "svelte";
  import Keypad from "./Keypad.svelte";
  import { writableGun } from './gunstores.js';
  
  let loadingBible;

  let defaultAddress = {book: "gn", chapter: 1, verse: 1, count: 1};
  let books = [];
  let booksByAbbr = new Map();

  let bookFilter = "";
  let shownBook;
  let lastAddresses = [
    defaultAddress,
  ];

  GUN_SUPER_PEERS = GUN_SUPER_PEERS || ['http://127.0.0.1/gun'];
  let gun = Gun(GUN_SUPER_PEERS);
  let overlay = gun.get('bible').get(window.location.hash || 'demo');

  /* Synced variables */
  let shown = writableGun(overlay.get('show'), false);
  let line1 = writableGun(overlay.get('line1'), '');
  let line2 = writableGun(overlay.get('line2'), '');
  let address = writableGun(overlay.get('address'), defaultAddress);
  let bodyclass = writableGun(overlay.get('bodyclass'), '');
  let bibleid = writableGun(overlay.get('bibleid'), 'roh');

  $: loadBible($bibleid + '.json');
  $: shownBook = booksByAbbr[$address.book] || {chapters:[], name: ""};
  $: $line1 = addressAsString($address);
  $: $line2 = addressContent($address);
  $: filteredBooks = bookFilter ? books.filter(matchesBook) : books;
  $: bookLength = (shownBook.chapters[$address.chapter]||[]).length;

  /* Disabled last address filtering
  $: filteredLastAddresses = bookFilter
    ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
    : lastAddresses;
  */

  function loadBible(path) {
    loadingBible = true;
    console.log('Loading Bible', path)
    let request = new XMLHttpRequest();
    request.open('GET', path);
    request.responseType = 'json';
    request.send();
    request.onload = function() {
      books = request.response.books;
      books && books.forEach(book => {booksByAbbr[book.abbreviation] = book});
      /* Redraw */
      lastAddresses = lastAddresses;
      // $address = $address;
      loadingBible = false;
    }
  }

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
    if (!booksByAbbr[address.book]) return '';
    var s = booksByAbbr[address.book].name + ' ' + address.chapter;
    if (address.verse) {
      s += ',' + address.verse;
      if (address.count > 1) {
        s += '-' + (address.verse + address.count - 1);
      }
    }
    return s;
  }

  function addressContent(a){
    var book = booksByAbbr[a.book];
    var content = '';
    if (book && $address.verse && book.chapters[$address.chapter]) {
      for (var i=$address.verse; i < $address.verse+$address.count; i++) {
        content += '\n' + (book.chapters[$address.chapter][i-1] || '');
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

  function addressSelector(a) {
    a.chapter = a.chapter || '';
    a.verse = a.verse || '';
    a.count = a.count || 1;
    return function() {
      console.debug('addressSelector:');
      $address = a;
    };
  }

  function removeLastAddress(j) {
    return function() {
      lastAddresses = lastAddresses.filter((h, i) => (i !== j));
    }
  }

  function toggleLine() {
    $shown = !$shown;
    if ($shown) {
      addToLastAddresses($address);
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
    margin: 0;
    padding: .5rem;
    text-align: left;
  }
  .address-item {
    width: 100%;
    padding: 0;
    margin: 0;
    max-width: 30rem;
  }
  .address-set {
    width: auto;
    padding: .5rem;
    margin: 0;
    text-align: left;
  }
  .address-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
    line-height: 1rem;
  }
  .vers,
  .address {
    color: white;
  }
  :global(body) {
    color: white;
  }
  button {
    margin: 0 0 .25rem 0;
    line-height: 1rem;
    width: 2.8rem;
  }
</style>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} />
  <button type="button" class="form-control btn btn-secondary" on:click={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as book}
  <button class="book-item btn" class:btn-primary={book.abbreviation==$address.book} on:click={addressSelector({book: book.abbreviation})}>{book.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each lastAddresses as addr, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(addr, $address)} on:click={addressSelector(addr)}>{addressAsString(addr) || (addr.book+' '+addr.chapter+','+addr.verse)}</button>
    <button class="btn btn-secondary address-remove" on:click={removeLastAddress(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: 0 .5rem 0 0; vertical-align: top;">
  Kapitola: {$address.chapter}
  <Keypad bind:value={$address.chapter} max={Object.keys(shownBook.chapters).length} />
  <button class="control-button btn"
          style="line-height: 2rem;"
          on:click={toggleLine} class:btn-danger={$shown} class:btn-success={!$shown}>
    {#if $shown}Skryť{:else}Zobraziť{/if}
  </button>
</div>
<div style="display: inline-block;">
  Verš: {$address.verse} {#if $address.count>1} - {$address.verse + $address.count - 1}{/if}
  <Keypad bind:value={$address.verse} max={bookLength} />
  <button class="btn btn-primary" on:click={function(){$address.count -= 1}}
          style="line-height: 2rem;"
          disabled={$address.count <= 1}>-1</button>
  <button class="btn btn-primary" on:click={function(){$address.count += 1}}
          style="line-height: 2rem;"
          disabled={$address.verse+$address.count > bookLength}>+1</button>
  <br/>
  <button class="btn btn-primary"
          style="line-height: 2rem;"
          on:click={function(){$address.verse=Math.max(1,$address.verse-$address.count)}}
          disabled={$address.verse <= 1}>⇐</button>
  <button class="btn btn-primary"
          style="line-height: 2rem;"
          on:click={function(){$address.verse=Math.min($address.verse+$address.count,bookLength-1)}}
          disabled={$address.verse+$address.count > bookLength}>⇒</button>
</div>

<div class="address">{$line1}</div>
<span class="vers" style="margin-bottom: 1rem;">{@html $line2}</span>

<br/>
<div class="bodyclass">
  Téma:
  <select bind:value={$bodyclass}>
    <option value="" selected>Predvolené</option>
    <option value="simple-with-shadow" selected>Jednoduché s tieňom</option>
    <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
  </select>
</div>

<div class="bible">
  Biblia:
  <select bind:value={$bibleid}>
    <option value="roh">Roháčkov</option>
    <option value="seb">Ekumenický</option>
  </select>
  {#if loadingBible}Načítava sa biblia {$bibleid}.{/if}
</div>
