<script>
  /* TODO: responsive overlays */
  /* TODO: detect duplicates on import */
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  import { Gun, wrapStore } from '$lib/gun.js';
  import { page } from "$app/stores";

  let songs = {};
  let songsSorted = [];

  let songFilter = "";
  let songsFiltered = songsSorted;
  let filterOpen = false;
  let settingsOpen = false;
  let editing = false;
  let editingSong;
  let playlist = [];

  /* Synced variables */
  let show = writable(false)
  let line1 = writable("")
  let bodyclass = writable("")
  let curSongIndex = writable(0)
  let curVerseIndex = writable(0)
  let songsGun = writable(false)

  onMount(function(){
    const gun = Gun([
      'https://gun.filiphanes.sk/gun',
    ])
    const overlay = gun.get('songs').get($page.url.hash || 'demo');
    show = wrapStore(overlay.get('show'), show);
    line1 = wrapStore(overlay.get('line1'), line1);
    bodyclass = wrapStore(overlay.get('bodyclass'), bodyclass);
    curSongIndex = wrapStore(overlay.get('curSongIndex'), curSongIndex);
    curVerseIndex = wrapStore(overlay.get('curVerseIndex'), curSongIndex);
    songsGun = overlay.get('songs');

    document.addEventListener('keydown', function(event) {
      if (editingSong) {
        if (event.code == 'Enter' && event.getModifierState("Control")){
          addNewVerse();
        }
        return;
      };

      if (event.code == 'ArrowDown') {
        $curVerseIndex = Math.min($curVerseIndex+1, curVerses.length-1);
      } else if (event.code == 'ArrowUp') {
        $curVerseIndex = Math.max($curVerseIndex-1, 0);
      } else if (event.code == 'ArrowLeft') {
        $curSongIndex = Math.max($curSongIndex-1, 0);
        $curVerseIndex = 0;
      } else if (event.code == 'ArrowRight') {
        $curSongIndex = Math.min($curSongIndex+1, playlist.length-1);
        $curVerseIndex = 0;
      } else if (event.code == 'Enter') {
        $show = !$show;
      }

      if (event.code == 'ArrowDown' || event.code == 'ArrowUp'
       || event.code == 'ArrowLeft' || event.code == 'ArrowRight'
      ) {
        event.preventDefault();
        scrollToVerse($curVerseIndex);
      }
    });
  });

  function refreshSongsDb() {
    songsGun.map().once(function(data, key) {
      // console.log('songs', key, data);
      // data && songsGun.get(key).put(null); // clear songs
      if (data === null) {delete songs[key]; return;}
      else songs[key] = data;
      /* Retreive verses immediately
      songsGun
        .get(Gun.node.soul(data))
        .get('verses')
        .once(function(songVerses){songs[key].verses = songVerses})
      */
    });
  };
  refreshSongsDb();
  let playlistGun = overlay.get('playlist');
  playlistGun.once(function(data) {
    // console.log('once playlist', data);
    // Cleanup playlist, remove holes
    if (data) {
      let pl = Object.entries(data).filter(a=>(a[1] && a[0] !== '_')).sort((a, b) => a[0] - b[0]).map(a=>a[1]);
      // console.log('once pl', pl);
      for (let i=0; data[i] !== undefined; i++) {
        if (data[i] != pl[i]) {
          // console.log('putting to', i, pl[i]);
          playlistGun.get(i).put(pl[i] || null);
        }
      }
    }
    // Subscribe to updates
    playlistGun.map().on(function(data, key) {
      // console.log('on playlist', key, data);
      // data && playlistGun.get(key).put(null); // clear playlist
      if (data === null) playlist = playlist.filter((song, i) => i != key);
      else playlist[key] = data;
    });
  });

  let curSong = {title:'', author:'', order:'', verses:{}};
  let curVerses = [];
  let newId = 's1';
  let newVerse = '';

  $: curSong = playlist[$curSongIndex] || {title:'', author:'', order:'', verses:{}};
  $: setCurVerses(curSong);
  $: $line1 = curVerses[$curVerseIndex] || '';
  $: songsSorted = Object.values(songs).sort((a, b) => (
    (a.title||'').replace(/\d+/g, s => ("0000" + parseInt(s)).slice(-4)).toLowerCase() >
    (b.title||'').replace(/\d+/g, s => ("0000" + parseInt(s)).slice(-4)).toLowerCase()
    ));
  $: songsFiltered = songFilter ? songsSorted.filter(matchesSong) : songsSorted;
  
  function setCurVerses(song) {
    if (song) {
      songsGun.get(Gun.node.soul(song)).get('verses')
      .once(function(songVerses){
        if (!songVerses) {
          curVerses = [];
        } else if (song.order.trim()) {
          let verses = [];
          song.order.split(' ').forEach(id => {
            if (songVerses[id]) verses.push(songVerses[id]);
          });
          curVerses = verses;
        } else {
          curVerses = Object.values(songVerses).filter(v=>(v !== null && typeof v !== 'object'));
        }
      })
    }
  }

  function matchesSong(song) {
    const prefix = songFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const titleLower = song.title.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      titleLower.startsWith(prefix) ||
      (prefix.length >= 2 && titleLower.includes(' '+prefix))
    );
  }

  function addToPlaylist(song) {
    console.log('adding to playlist', playlist.length, song);
    playlistGun.get(playlist.length).put(song);
  }

  function removePlaylistItem(i) {
    if (i < $curSongIndex) $curSongIndex -= 1;
    /* Keep playlist clean */
    while(playlist[++i]) {
      playlistGun.get(i-1).put(playlist[i]);
    }
    playlistGun.get(i-1).put(null);
  }

  function addNewSong() {
    editingSong = {title: '', author: '', order: '', verses: {}};
    newId = 'v1';
    editing = true;
  }

  function removeSong(song) {
    songsGun.get(Gun.node.soul(song)).put(null);
    refreshSongsDb();
  }

  function toggleEdit(song) {
    if (editing) {
      editing = false;
      let soul = Gun.node.soul(editingSong);
      if (soul) {
        songsGun.get(soul).put(editingSong);
      } else {
        console.log('New song', editingSong);
        songsGun.set(editingSong);
        refreshSongsDb();
      }
    } else {
      editingSong = song;
      songsGun.get(Gun.node.soul(song))
        .get('verses')
        .once(verses => {
          editingSong.verses = verses;
          generateNewId();
          editing = true;
        });
    }
  }

  function removeVerse(id) {
    if (!newVerse) newId = id;
    editingSong.verses[id] = null;
  }
  
  function addNewVerse() {
    if (!editingSong.verses) editingSong.verses = {};
    if (newId && !editingSong.verses[newId])
      editingSong.verses[newId] = newVerse;
    /* Clean new verse */
    newVerse = '';
    generateNewId();
  }

  function generateNewId() {
    if (editingSong.verses) {
      while (editingSong.verses[newId]) {
        let newId2 = newId.replace(/\d+/, (n)=>(parseInt(n)+1));
        if (newId === newId2) newId += '1';
        else newId = newId2;
      }
    }
  }

  function scrollToVerse(i) {
    let e = document.querySelector('.verse-item:nth-child('+i+')');
    e && e.scrollIntoView();
  }

  function toggleShow() {
    $show = !$show;
  }

  function importSongs() {
    let files = document.getElementById('songsUpload').files;
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      reader.onload = function(e) {
        let parser = new DOMParser();
        let dom = parser.parseFromString(e.target.result, "application/xml");
        if(dom.documentElement.nodeName == "parsererror") {
          console.log(dom);
          return;
        }
        let title = dom.querySelector('song properties title');
        let author = dom.querySelector('song properties author');
        let verseOrder = dom.querySelector('song properties verseOrder');
        let song = {
          title: title ? title.innerHTML : '',
          author: author ? author.innerHTML : '',
          order: verseOrder ? verseOrder.innerHTML : '',
          verses: {},
        };
        dom.querySelectorAll('song lyrics verse').forEach(function(verse){
          song.verses[verse.getAttribute('name')] = verse.querySelector('lines').innerHTML.replace(/<br[^>]*>/g, '\n');
        });
        songsGun.set(song);
      };
      reader.readAsText(files[i]);
    }
  }
</script>

<style>
  :global(body) {
    color: white;
    max-height: 100vh;
  }
  .settings,
  .songs-filter,
  .songs-control {
    display: block;
    margin: 0;
    padding: 0;
    width: 100%;
    max-height: calc(100vh - 5.75rem);
    position: absolute;
    left: -100%;
    overflow: scroll;
    z-index: 30;
  }
  .settings.show,
  .songs-filter.show,
  .songs-control.show {
    left: 0;
  }
  .songs-filter .song-set {
    text-align: left;
  }
  .songs-filter .song-add {
    max-width: 3rem;
  }
  .songs-filter .song-edit {
    max-width: 2rem;
  }
  .songs-filter .song-remove {
    max-width: 2rem;
  }

  .settings {
    padding: 1rem;
    background: var(--dark);
  }

  .song-item {
    width: 100%;
    margin: 0;
    padding: 0;
    text-align: left;
    border-bottom: 1px solid #555;
    background-color: #222;
  }
  .song-item:hover {
    border-color: #9d7108;
  }
  .playlist {
    display: inline-block;
    overflow: auto;
    vertical-align: top;
    width: 100%;
    margin: 0 0 1rem 0;
  }
  .playlist .song-set {
    width: auto;
    padding: 0 .75rem;
    margin: 0;
    text-align: left;
  }
  .playlist .song-remove {
    margin: 0;
    max-width: 2rem;
    padding: .25rem .5rem;
  }
  .song-create {
    float: right;
  }

  .verses {
    display: inline-block;
    overflow: auto;
    width: 100%;
  }
  .verse-item {
    border-bottom: 1px solid;
    border-color: #3c3b3b;
    padding: .5rem .5rem;
    margin: 0;
    width: 100%;
    white-space: pre;
  }
  .verse-item:hover {
    border-color: wheat;
  }
  .verse-item.active {
    border-color: yellow;
    color: white;
    background: #375a7f;
  }
  .verse-item:last-child {
    border-bottom: none;
  }
  p[contenteditable="true"] {
    background-color: white;
    color: black;
    min-height: 3rem;
    max-width: calc(100% - 4rem);
    padding: .5rem .5rem;
    white-space: pre;
  }
  p[contenteditable="true"]:focus-within {
    background-color: lightyellow;
  }
  .verse-id {
    float: right;
    padding: .5rem;
  }
  .verse-new-id {
    float: right;
    padding: 0 0 0 .25rem;
    width: 1.8rem;
  }
  .verse-new-item {
    min-height: 3rem;
  }
  .verse-add {
    float: right;
  }
  .verse-remove {
    float: right;
    padding: .5rem 0.75rem;
  }

  .bottom-buttons {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
  }
  .bottom-buttons button {
    margin: 0;
    padding: 1rem 0.25rem;
  }
  @media screen and (min-width: 640px) {
    .songs-filter,
    .songs-control {
      display: inline-block;
      margin: 0;
      padding: 0;
      width: 30rem;
      max-height: calc(100vh - 5.75rem);
      position: static;
      left: 0;
      overflow: scroll;
      vertical-align: top;
      z-index: 30;
    }
    .settings.show {
      width: 30rem;
      left: auto;
      right: 0;
    }
    .songs-control {
      display: inline-block;
      max-width: 60rem;
    }
    .playlist {
      display: inline-block;
      max-width: 20rem;
    }
    .info-bar {
      display: inline-block;
    }
    .verses {
      width: 30rem;
    }
  }
</style>

<svelte:head>
	<title>Songs controller</title>
</svelte:head>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter piesní"
    bind:value={songFilter}
    on:input={()=>{filterOpen = true;}}
    on:click={()=>{filterOpen = !filterOpen;}}
    />
  <button type="button" class="form-control btn btn-secondary"
    style="max-width: 2rem; padding: .25rem;"
    on:click={()=>{filterOpen=!!songFilter; songFilter=''}}
    title="Zrušiť filter"
    >×</button>
  <button type="button" class="form-control btn btn-secondary"
    style="max-width: 2rem; padding: .25rem;"
    on:click={()=>{settingsOpen = !settingsOpen}}
    title="Nastavenia"
    >⚙</button>
</div>

<div class="settings" class:show={settingsOpen}>
  <p>
    Téma:
    <select bind:value={$bodyclass}>
      <option value="" selected>Predvolené</option>
      <option value="simple-with-shadow">Jednoduché s tieňom</option>
    </select>
  </p>
  <p>
    Import piesní vo formáte OpenLyrics (z OpenLP):
    <input id="songsUpload" type="file" name="files" multiple on:change={importSongs}>
  </p>
  <p>
    <strong>Klávesové skratky:</strong><br/>
    <strong>Šípky Hore - Dole:</strong>
    prepínanie medzi verša aktuálnej piesne.<br/>
    <strong>Šípky Vľavo - Vpravo:</strong>
    prepínanie medzi piesňami v playliste.<br/>
    <strong>Enter:</strong>
    Zobraziť/Skryť verš<br/>
    <strong>Ctrl+Enter:</strong>
    Pri úprave piesne vloží nový verš.<br/>
  </p>
</div>


<div class="songs-filter" class:show={filterOpen}>
  {#each songsFiltered as song}
  <div class="song-item btn-group">
    <button class="song-set btn"
      class:btn-primary={song==curSong}
      on:click={()=>{addToPlaylist(song); filterOpen=false}}
    >{song.title}</button>
    <button class="song-add btn btn-success" on:click={()=>addToPlaylist(song)}>+</button>
    <button class="song-edit btn btn-secondary" on:click={()=>{toggleEdit(song); filterOpen=false}}>✎</button>
    <button class="song-remove btn btn-secondary" on:click={()=>removeSong(song)}>🗑</button>
  </div>
  {/each}
</div>

<div class="songs-control" class:show={!filterOpen && !settingsOpen}>
  <div class="playlist">
    {#each playlist as song, i}
    <div class="song-item btn-group">
      <button class="song-set btn"
        class:btn-primary={$curSongIndex==i}
        on:click={()=>{$curSongIndex = i}}
      >{song.title}</button>
      <button class="song-remove btn btn-secondary" on:click={()=>removePlaylistItem(i)}>×</button>
    </div>
    {:else}
      Playlist je prázdny, pridajte piesne z filtra.
    {/each}
  </div>

  <div class="info-bar">
    <button class="song-edit btn" class:btn-success={editing}
            on:click={()=>toggleEdit(curSong)}
            title="Upraviť"
      >✎{#if editing} Uložiť{/if}
    </button>
    <button class="song-create btn" on:click={addNewSong} title="Vytvoriť novú pieseň">+</button>
    {#if editing}
      <button class="song-cancel btn btn-secondary" on:click={()=>{editing=false}}>× Zrušiť</button>
      <button class="song-remove btn btn-danger" on:click={()=>{editing=false; removeSong(editingSong)}}>🗑 Odstrániť</button>
      <input class="form-control" type="text" placeholder="title" bind:value={editingSong.title} />
      <input class="form-control" type="text" placeholder="author" bind:value={editingSong.author} />
      <input class="form-control" type="text" placeholder="order" bind:value={editingSong.order} />
    {:else}
      <span>{curSong.title}</span>
    {/if}
  </div>
  <div class="verses">
    {#if editing}
      {#each Object.entries(editingSong.verses||{}).filter(e=>typeof e[1] != 'object' && e[1] != null) as [id, verse]}
      <button class="verse-remove btn btn-secondary" on:click={()=>removeVerse(id)}>×</button>
      <span class="verse-id">{id}</span>
      <p class="verse-item" contenteditable="true" bind:innerHTML={editingSong.verses[id]}></p>
      {/each}
    {:else}
      {#each curVerses as verse, i}
      <p class="verse-item" class:active={$curVerseIndex==i} on:click={()=>{$curVerseIndex = i}} on:keyup={()=>{$curVerseIndex = i}}>
        {verse}
      </p>
      {/each}
    {/if}
    {#if editing}
      <button class="verse-add btn btn-success" on:click={addNewVerse} title="Pridať nový verš">+</button>
      <input class="form-control verse-new-id" type="text" placeholder="id" bind:value={newId} />
      <p class="verse-new-item" contenteditable="true" bind:innerHTML={newVerse}></p>
    {/if}
  </div>
</div>

<div class="bottom-buttons btn-group">
  <button class="btn btn-primary"
          on:click={function(){$curSongIndex -= 1}}
          disabled={$curSongIndex <= 0}>← Pieseň</button>
  <button class="btn btn-primary"
          on:click={function(){$curSongIndex += 1}}
          disabled={$curSongIndex >= playlist.length-1}>Pieseň →</button>

  <button class="control-button btn" on:click={toggleShow} class:btn-danger={$show} class:btn-success={!$show}>
    {#if $show}Skryť{:else}Zobraziť{/if}
  </button>

  <button class="btn btn-primary"
          on:click={()=>{$curVerseIndex -= 1; scrollToVerse($curVerseIndex)}}
          disabled={$curVerseIndex <= 0}>↑ Verš</button>
  <button class="btn btn-primary"
          on:click={()=>{$curVerseIndex += 1; scrollToVerse($curVerseIndex)}}
          disabled={$curVerseIndex >= curVerses.length-1}>Verš ↓</button>
</div>


<!--div>
{#each songsFiltered as song}
  <div class="song">
    <h2>{song.title}</h2>
    <strong>Poradie:</strong> <p>{song.order}</p>
    {#each Object.entries(song.verses).filter(a=>(a[1] && a[0] !== '_')) as [id, verse]}
      <strong>{id}:</strong>
      <p>{verse}</p>
    {/each}
  </div>
{/each}
</div-->