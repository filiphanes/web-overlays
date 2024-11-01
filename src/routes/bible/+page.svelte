<svelte:head>
	<title>Biblia ovládač</title>
</svelte:head>
<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import NumberPad from "$lib/NumberPad.svelte";
  import { MultiBroker } from '$lib/broker.svelte.js';
  import {index as roh} from "./roh.json.js"
  import {index as seb} from "./seb.json.js"
  import {index as sep} from "./sep.json.js"
  import {index as ssv} from "./ssv.json.js"
  import {index as bot} from "./bot.json.js"
  import {index as csp} from "./csp.json.js"
  import {index as kjv} from "./kjv.json.js"

  const bibles = $state({roh, seb, sep, ssv, bot, csp, kjv});
  /* Set index for each book */
  for (const [id, bible] of Object.entries(bibles)) {
    bible.books = {};
    let i = 0;
    for (const book of bible.bookslist) {
      book.index = i++;
      bible.books[book.abbreviation] = book;
    }
  }

  let defaultAddress = { bible: "roh", book: "gn", chapter: 1, verse: 1, verseCount: 1 };
  let bookFilter = $state("");
  let history = $state([defaultAddress,]);
  let showNextVerses = $state(true);
  let hideOnSelector = $state(true);
  let splitButton = $state(false);

  /* Synced variables */
  let address = $state(defaultAddress);
  let show   = $state(false);
  let verseNumbers = $state(false);
  let theme   = $state('');
  let program = $state({});
  let bible2  = $state('')
  /* TODO: sync both ways */

  /* Derived variables */
  let address2 = $derived({bible: bible2, book: address.book, chapter: address.chapter, verse: address.verse, verseCount: address.verseCount});
  let books1 = $derived(bibles[address.bible].books);
  let line1 = $derived(addressAsString(address));
  let line2 = $derived(addressContent(address, verseNumbers));
  let line3 = $derived(address2.bible ? addressAsString(address2) : "");
  let line4 = $derived(address2.bible ? addressContent(address2, verseNumbers) : "");
  let bookLength = $derived(Object.keys(bibles[address.bible].books[address.book].chapters||{}).length);
  let chapterLength = $derived(((bibles[address.bible].books[address.book].chapters||{})[address.chapter]||[]).length);
  let addressNext = $derived(nextVerse({...address}));
  let address2Next = $derived(nextVerse({...address2}));
  let line2Next = $derived(addressContent(addressNext, verseNumbers));
  let line4Next = $derived(addressContent(address2Next, verseNumbers));
  let bookList = $derived(bibles[address.bible].bookslist);
  let filteredBooks = $derived(bookFilter ? bookList.filter(matchesBook) : bookList);

  const broker = new MultiBroker();
  $effect(()=>broker.set('show', show))
  $effect(()=>broker.set('line1', line1))
  $effect(()=>broker.set('line2', line2))
  $effect(()=>broker.set('line3', line3))
  $effect(()=>broker.set('line4', line4))
  $effect(()=>broker.set('theme', theme))
  $effect(()=>broker.set('program', program))
  $effect(()=>broker.set('allinone', JSON.stringify({show, line1, line2, line3, line4}))) // TODO: remove
  
	onMount(() => {
    broker.setup({
      space: 'bible',
      password: $page.url.hash.slice(1) || 'demo',
      ...Object.fromEntries($page.url.searchParams)
    });
  })


  async function fetchChapters(bibleid, abbreviation) {
    // console.log('fetchChapters(', bibleid, abbreviation);
    if (!bibleid) return;
    let chapters = bibles[bibleid].books[abbreviation]?.chapters;
    if (chapters) {
      return chapters;
    } else {
      const res = await fetch(`/bible/${bibleid}/${abbreviation}.json`);
      chapters = await res.json();
    }
    return chapters;
  }

  function matchesBook(book) {
    const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      bookLower.startsWith(prefix) ||
      book.abbreviation.startsWith(prefix) ||
      (book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix))) ||
      (prefix.length >= 2 && bookLower.includes(' ' + prefix))
    );
  }

  function addToHistory(a) {
    history.unshift({
      book: a.book,
      chapter: a.chapter,
      verse: a.verse,
      verseCount: a.verseCount,
    });
    /* remove earlier duplicates */
    history = history.filter((h, i) => i === 0 || !equalAddresses(h, a));
  }

  function addressAsString(a) {
    if (a === undefined || !a.bible) return '';
    const books = bibles[a.bible].books;
    if (!books[a.book]) return '';
    var s = books[a.book].name + ' ' + a.chapter;
    if (a.verse) {
      s += ',' + a.verse;
      if (a.verseCount > 1) {
        s += '-' + (a.verse + a.verseCount - 1);
      }
    }
    return s;
  }

  function addressContent(a, numbers) {
    if (a === undefined || !a?.bible) return '';
    const book = bibles[a.bible].books[a.book];
    let content = '';
    // console.log('addressContent', a, books);
    if (book) {
      if (!book.chapters) {
        return content;
      }
      if (a.verse && book.chapters[a.chapter]) {
        for (var i = a.verse; i < a.verse + a.verseCount; i++) {
          content += `\n`;
          if (numbers) {
            content += `<sup>${i}</sup>`;
          }
          content += book.chapters[a.chapter][i - 1] || '';
        }
      }
    }
    return content;
  };

  function equalAddresses(a, b) {
    return b !== undefined &&
      a.book == b.book &&
      a.chapter == b.chapter &&
      a.verse == b.verse &&
      a.verseCount == b.verseCount;
  }

  function addressSelector(a) {
    return function () {
      if (hideOnSelector) show = false;
      fetchChapters(address.bible, a.book).then((chapters) => {
        bibles[address.bible].books[a.book].chapters = chapters;
        address.book = a.book;
        address.chapter = a.chapter || '';
        address.verse = a.verse || '';
        address.verseCount = a.verseCount || 1;
      });
      if (address2.bible && address.bible != address2.bible && !bibles[address2.bible].books[a.book].chapters) {
        fetchChapters(address2.bible, a.book).then((chapters) => {
          bibles[address2.bible].books[a.book].chapters = chapters;
        });
      }
    };
  }

  function removeHistory(j) {
    return function () {
      history = history.filter((h, i) => (i !== j));
    }
  }

  function toggleShown() {
    show = !show;
    if (show) {
      addToHistory(address);
    }
  }

  function sendToProgram() {
    program = { line1, line2, line3, line4 }
  }

  function prevVerse(a) {
    a.verse = +a.verse - a.verseCount;
    if (a.verse <= 0) {
      a = prevChapter(a);
      a.verse = books1[a.book].chapters[a.chapter]?.length || 1;
    }
    return a;
  };

  function nextVerse(a) {
    a.verse = +a.verse + a.verseCount;
    if (a.verse > chapterLength) {
      a = nextChapter(a);
    }
    return a;
  };

  function prevChapter(a) {
    a.chapter = +a.chapter - 1;
    if (a.chapter <= 0) {
      a = prevBook(a);
      a.chapter = Object.keys(books1[a.book].chapters||{}).length;
    }
    return a;
  };

  function nextChapter(a) {
    a.chapter = +a.chapter + 1;
    if (a.chapter > bookLength) {
      a.chapter = 1;
      a = nextBook(a);
    }
    a.verse = 1;
    return a;
  };

  function prevBook(a) {
    const books = bibles[address.bible].bookslist;
    const newIndex = books1[a.book].index - 1 + books.length;
    a.book = books[newIndex%books.length].abbreviation;
    console.log('newIndex', newIndex, address.book);
    return a;
  };

  function nextBook(a) {
    const books = bibles[address.bible].bookslist;
    const newIndex = books1[a.book].index + 1;
    a.book = books[newIndex%books.length].abbreviation;
    return a;
  };
  
  function gotoPrevVerse() {
    address.verse = Math.max(1, address.verse-address.verseCount);
    // if (program.line1) sendToProgram;
  }
  
  function gotoNextVerse() {
    address = nextVerse({...address});
    // address.verse = Math.min(address.verse+address.verseCount, chapterLength);
    // if (program.line1) sendToProgram;
  }
  function changeBible1(event) {
    const newbible = event.target.value;
    fetchChapters(newbible, address.book).then((chapters) => {
      bibles[newbible].books[address.book].chapters = chapters;
      address.bible = newbible;
    });
  }
  function changeBible2(event) {
    const newbible = event.target.value;
    if (!newbible) {
      bible2 = newbible;
      return;
    }
    fetchChapters(newbible, address.book).then((chapters) => {
      bibles[newbible].books[address.book].chapters = chapters;
      bible2 = newbible;
    })
  }
</script>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} style="flex-grow:1;" />
  <button type="button" class="form-control btn btn-secondary" onclick={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as b}
  <button class="book-item btn" class:btn-primary={b.abbreviation==address.book} onclick={addressSelector({book: b.abbreviation})}>{b.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each history as addr, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(addr, address)} onclick={addressSelector(addr)}>{addressAsString({bible: address.bible, ...addr}) || (addr.book+' '+addr.chapter+','+addr.verse)}</button>
    <button class="btn btn-secondary address-remove" onclick={removeHistory(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Kapitola: {address.chapter} z {bookLength}
  <NumberPad bind:value={address.chapter} max={bookLength} />
  <button class="btn btn-primary" onclick={()=>{address.chapter=Math.max(1,address.chapter-1)}} style="line-height: 2rem;"
  >⇦</button><button class="btn btn-primary" onclick={()=>{address.chapter=Math.min(address.chapter+1,bookLength)}} style="line-height: 2rem;"
  >⇨</button><br/>
  {#if splitButton}
    <button class="control-button btn btn-success" style="line-height: 2rem;" onclick={sendToProgram}>Zobraziť</button>
    <button style="line-height: 2rem;" onclick={()=>{program={}}} class="btn btn-danger">&times;</button>
  {:else}
    <button style="line-height: 2rem;" onclick={toggleShown} class="btn control-button" class:btn-danger={show} class:btn-success={!show}
    >{#if show}Skryť{:else}Zobraziť{/if}</button>
  {/if}
</div>
<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Verš: {address.verse} {#if address.verseCount>1} - {address.verse + address.verseCount - 1}{/if} z {chapterLength}
  <NumberPad bind:value={address.verse} max={chapterLength} />
  <button class="btn btn-primary" style="line-height: 2rem;" onclick={gotoPrevVerse} disabled={address.verse<=1}
  >⇦</button><button class="btn btn-primary" style="line-height: 2rem;" onclick={gotoNextVerse} disabled={address.verse+address.verseCount>chapterLength}
  >⇨</button><br/><button disabled style="background: transparent;" aria-label="empty"
  ></button><button class="btn btn-primary" onclick={()=>{address.verseCount -= 1}} style="line-height: 2rem;" disabled={address.verseCount<=1}
  >-1</button><button class="btn btn-primary" onclick={()=>{address.verseCount += 1}} style="line-height: 2rem;" disabled={address.verseCount>chapterLength}
  >+1</button><br/><button disabled style="background: transparent;" aria-label="empty"
  ></button>
</div>

<div class="preview">
  {line1}<br/>
  {@html line2}
</div>
{#if showNextVerses}
<div class="preview next">
  {@html line2Next}
</div>
{/if}

{#if address2.bible}
<div class="preview">
  {line3}<br/>
  {@html line4}
</div>
{#if showNextVerses}
<div class="preview next">
  {@html line4Next}
</div>
{/if}
{/if}

<br />
<div class="settings">
  <div class="bible">
    Preklad:
    <select value={address.bible} onchange={changeBible1}>
    {#each Object.entries(bibles) as [id, bible]}
      <option value={id}>{bible.name}</option>
    {/each}
    </select>
  </div>

  <div class="bible">
    Preklad 2:
    <select value={address2.bible} onchange={changeBible2}>
      <option value="">Žiadny</option>
    {#each Object.entries(bibles) as [id, bible]}
      <option value={id}>{bible.name}</option>
    {/each}
    </select>
  </div>

  <div class="theme">
    Téma:
    <select bind:value={theme}>
      <option value="" selected>Predvolená</option>
      <option value="simple-with-shadow" selected>Jednoduché s tieňom</option>
      <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
    </select>
  </div>

  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={verseNumbers} /> Čísla veršov
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={showNextVerses} /> Nasledujúce verše
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={hideOnSelector} /> Skryť pri výbere knihy
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={splitButton} /> Texty do programu až po kliknutí
    </label>
  </div>

</div>

<style>
input,
button,
select {
  font-family: inherit;
  font-size: inherit;
  padding: 0.4em;
  margin: 0 0 0.25em 0;
  box-sizing: border-box;
  border: none;
  background: #555;
  color: whitesmoke;
  border-radius: .5rem;
}

input:disabled {
  color: #ccc;
}

button {
  color: whitesmoke;
  background-color: #555;
  font-size: 1rem;
  outline: none;
  margin: 0;
  line-height: 2rem;
  width: 3rem;
  border: 1px solid black;
  border-radius: .5rem;
  user-select: none
}

button:active {
  background-color: #ddd;
  color: black;
}

button:focus {
  border-color: #666;
}

.control-button {
  width: 6rem;
  /* float: right; */
}

.books-filter,
.address-filter {
  display: block;
  width: 49%;
  margin: 0 1% 1rem 0;
  padding: 0;
  height: 10rem;
  overflow: scroll;
  float: left;
  max-width: 15rem;
}

.book-item,
.address-set,
.address-remove {
  width: 100%;
  margin: 0 0 .1rem;
  padding: .3rem;
  text-align: left;
  color: whitesmoke;
  border-radius: 0;
  background: black;
}

.address-item {
  width: 100%;
  padding: 0;
  margin: 0;
  max-width: 30rem;
  display: flex;
}

.address-set {
  width: auto;
  padding: .5rem;
  margin: 0;
  text-align: left;
  flex-grow: 2;
}

.address-remove {
  margin: 0;
  max-width: 2rem;
  padding: .25rem .5rem;
  line-height: 1rem;
}

.preview {
  padding: .5rem;
  user-select: text;
}
.preview.next {
  color: #777;
}

.btn-success {
  background-color: green;
}

.btn-danger {
  background-color: red;
}

.settings {
  padding: .5rem;
}
</style>