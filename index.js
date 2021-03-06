'use strict'
let helpers = require("./helpers")

helpers.load_or_unzip(function(data) {

  //
  //some helper methods

  let fast_search = function(str, k) {
    let founds = []
    let l = data[k].length;
    for (let i = 0; i < l; i++) {
      for (let o = 0; o < data[k][i].words.length; o++) {
        if (data[k][i].words[o] === str) {
          founds.push(data[k][i])
          break
        }
      }
    }
    return founds
  }

  let is_id = function(str) {
    return str.match(/[a-z]\.(adjective|verb|noun|adverb)\.[0-9]/i) !== null
  }

  let id_lookup = function(id, k) {
    let l = data[k].length;
    for (let i = 0; i < l; i++) {
      if (data[k][i].id === id) {
        return [data[k][i]]
      }
    }
    return null
  }

  let lookup = function(str, k) {
    //given an id
    if (is_id(str)) {
      let type = str.match(/[a-z]\.(adjective|verb|noun|adverb)\.[0-9]/i)[1]
      return id_lookup(str, type)
    }
    //given a pos
    if (k) {
      if (str) {
        return fast_search(str, k)
      }
      return data[k]
    }
    //else, lookup in all types
    let types = ["adverb", "adjective", "verb", "noun"]
    let all = []
    for (let i = 0; i < types.length; i++) {
      all = all.concat(fast_search(str, types[i]))
    }
    return all
  }

  const reduceHypernyms = (stopList, words, currentId) => {
     let newWords = [].concat(words);
     var res = lookup(currentId).forEach(function(syn) {
         syn.relationships.type_of.forEach(function(id) {
             const hypernym = lookup(id)[0];

             if (stopList.includes(hypernym.id.split('.')[0])) {
                 return;
             }

             newWords = newWords.concat(hypernym.words);
             const hypernymWords = getHypernyms([hypernym.id], stopList);
             newWords = newWords.concat(hypernymWords);
         });
     });
     return newWords;
  };

  const getHypernyms = (ids, stopList) => {
    const hypernyms = ids.reduce(reduceHypernyms.bind(null, stopList), []) || [];
    return hypernyms.filter((hypernym, index) => {
        return hypernyms.indexOf(hypernym) === index;
    });
  };
    //
  //begin API now
  exports.lookup = lookup
  exports.data = data

  //main methods
  exports.adverb = function(s) {
    return lookup(s, "adverb")
  }
  exports.adjective = function(s) {
    return lookup(s, "adjective")
  }
  exports.verb = function(s) {
    return lookup(s, "verb")
  }
  exports.noun = function(s) {
    return lookup(s, "noun")
  }

  exports.getContextualIds = function(s, pos, relatedTerms = []) {
      const synonyms = exports.synonyms(s, pos);
      const hypernyms = exports.hypernyms(s, pos);

      const lexicalFields = synonyms.map((synset, index) => [].concat(synset.close, synset.far, hypernyms[index].hypernyms));

      return lookup(s, pos).filter((synset, index) => relatedTerms.some(term => {
          console.log(relatedTerms, lexicalFields[index]);
          return lexicalFields[index].includes(term)
        }))
        .map(synset => synset.id);
  };

  exports.hypernyms = function(s, pos, stopList = []) {
    return lookup(s, pos).map(function(syn) {
        let loose = syn.similar && syn.similar.map(function(id) {
            return lookup(id, pos)[0].words
        })
        return {
            synset: syn.id,
            hypernyms: getHypernyms([syn.id], stopList)
        }
    });
  };

  exports.synonyms = function(s, pos) {
    return lookup(s, pos).map(function(syn) {
      let loose = syn.similar && syn.similar.map(function(id) {
        return lookup(id, pos)[0].words
      })
      return {
        synset: syn.id,
        close: syn.words.filter(function(w) {
          return w !== s
        }),
        far: helpers.flatten(loose).filter(function(w) {
          return w !== s
        })
      }
    })
  }

  exports.antonyms = function(s) {
    let ants = lookup(s, "adjective").map(function(syn) {
      return syn.antonym
    })
    ants = helpers.unique(helpers.flatten(ants))
    let all = ants.map(function(id) {
      return lookup(id, "adjective")[0]
    })
    return all
  }
  exports.pos = function(s) {
    return helpers.unique(lookup(s).map(function(syn) {
      return syn.syntactic_category
    }))
  }

  exports.words = function(cb) {
    helpers.load_or_unzip((obj)=>{
      let keys=Object.keys(obj)
      let words={}
      for (let i=0; i<keys.length; i++){
        for (let o=0; o<obj[keys[i]].length; o++){
          for (let w=0; w<obj[keys[i]][o].words.length; w++){
            words[obj[keys[i]][o].words[w]]=true
          }
        }
      }
      cb(Object.keys(words).sort())
    })
  }

})

// console.log(exports.pos("perverse"))
// console.log(exports.antonyms("perverse"))
// exports.words((arr)=>{
//   console.log(arr.filter((s)=> s.match(/cool/)))
// })
// exports.words((arr)=>{console.log(arr.slice(110,113))})
