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

  const fast_holonym_search = function(str, k) {
    if (k !== 'noun') {
        return [];
    }
    let founds = []
    let l = data[k].length;
    for (let i = 0; i < l; i++) {
        if (!data[k][i].relationships.members) {
            continue;
        }
        for (let o = 0; o < data[k][i].relationships.members.length; o++) {
            if (data[k][i].relationships.members[o] === str) {
                founds.push(data[k][i]);
                continue;
            }
        }
    }
    return founds
  };

  const fast_hyponym_search = function(str, k) {
      if (k !== 'noun') {
        return [];
      }
      let founds = []
      let l = data[k].length;
      for (let i = 0; i < l; i++) {
          if (!data[k][i].relationships.type_of) {
            continue;
          }
          for (let o = 0; o < data[k][i].relationships.type_of.length; o++) {
              if (data[k][i].relationships.type_of[o] === str) {
                  founds.push(data[k][i]);
                  continue;
              }
          }
      }
      return founds
  };

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

  const reduceMeronyms = (limit, callCount, stopList, words, currentId) => {
    let newWords = [].concat(words);
    var res = lookup(currentId).forEach(function(syn) {
        syn.relationships.members.forEach(function(id) {
            const meronym = lookup(id)[0];

            if (stopList.includes(meronym.id.split('.')[0])) {
                return;
            }

            newWords = newWords.concat(meronym.words);

            if (limit >= 0 && callCount >= limit) {
                return;
            }
            const meronymWords = getWords(reduceHypernyms, [meronym.id], limit, callCount + 1, stopList);
            newWords = newWords.concat(meronymWords);
        });
    });
    return newWords;
  };

  const reduceHolonyms = (limit, callCount, stopList, words, currentId) => {
    let newWords = [].concat(words);
    var res = lookup(currentId).forEach(function(syn) {
        fast_holonym_search(syn.id, syn.id.split('.')[1]).forEach(function(hyponym) {
            newWords = newWords.concat(hyponym.words);
            if (limit >= 0 && callCount >= limit) {
                return;
            }

            const holonymWords = getWords(reduceHolonyms, [hyponym.id], limit, callCount+1);
            newWords = newWords.concat(holonymWords);
        });
    });
    return newWords;
  };

  const reduceHyponyms = (limit, callCount, stopList, words, currentId) => {
    let newWords = [].concat(words);
    var res = lookup(currentId).forEach(function(syn) {
      fast_hyponym_search(syn.id, syn.id.split('.')[1]).forEach(function(hyponym) {
          newWords = newWords.concat(hyponym.words);
          if (limit >= 0 && callCount >= limit) {
            return;
          }

          const hyponymWords = getWords(reduceHyponyms, [hyponym.id], limit, callCount+1);
          newWords = newWords.concat(hyponymWords);
      });
    });
return newWords;
  };

  const reduceHypernyms = (limit, callCount, stopList, words, currentId) => {
     let newWords = [].concat(words);
     var res = lookup(currentId).forEach(function(syn) {
         syn.relationships.type_of.forEach(function(id) {
             const hypernym = lookup(id)[0];

             if (stopList.includes(hypernym.id.split('.')[0])) {
               return;
             }

             newWords = newWords.concat(hypernym.words);

             if (limit >= 0 && callCount >= limit) {
                 return;
             }
             const hypernymWords = getWords(reduceHypernyms, [hypernym.id], limit, callCount + 1, stopList);
             newWords = newWords.concat(hypernymWords);
         });
     });
     return newWords;
  };

  const getWords = (reduceFunction, ids, limit = -1, callCount = 1, stopList = []) => {
    const hypernyms = ids.reduce(reduceFunction.bind(null, limit, callCount, stopList), []) || [];
    return hypernyms.filter((hypernym, index) => {
        return hypernyms.indexOf(hypernym) === index;
    });
  };


  const isWordMatchingSomeIds = (s, synsets, wordCounter) => {
      return synsets.some(synset => {
          const parts = synset.id.split('.');
          return synsets.some(syn => parts[0] === s && parts[2] === wordCounter);
      });
  };

  const getIdsOfMostCommonMeaning = (s, synsets) => {
      return synsets.filter((synset, index) => {
        const parts = synset.id.split('.');

        if (s === synset.id) {
          return true;
        }

        for (let i = 1; i <=20; i++) {
            let wordCounter = '' + i;
            if (wordCounter.length === 1) {
                wordCounter = '0' + wordCounter;
            }
            if (isWordMatchingSomeIds(s, synsets, wordCounter)) {
                return parts[0] === s && parts[2] === wordCounter;
            }
        }

        return index === 0;
      })
      .map(synset => synset.id);

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

  exports.getContextualIds = function(s, pos, relatedTerms = [], options = {}) {
      const fallbackToFirst = options.fallbackToFirst === undefined ? true : options.fallbackToFirst;
      const includeDescription = options.includeDescription === undefined ? true : options.includeDescription;
      const includeSynonyms = options.includeSynonyms === undefined ? true : options.includeSynonyms;
      const includeHypernyms = options.includeHypernyms === undefined ? true : options.includeHypernyms;
      const includeHyponyms = options.includeHyponyms === undefined ? true : options.includeHyponyms;
      const includeHolonyms = options.includeHolonyms === undefined ? true : options.includeHolonyms;
      const includeMeronyms = options.includeMeronyms === undefined ? true : options.includeMeronyms;


      let synsets = lookup(s, pos).map(synset => {
          synset.lexicalField = [];
          return synset;
      });

      if (includeDescription) {
          synsets = synsets.map(synset => {
              synset.lexicalField = synset.lexicalField.concat(synset.description.split(' '));
              return synset;
          });
      }

      if (includeSynonyms) {
          synsets = synsets.map(synset => {
              const synonyms = exports.synonyms(synset.id, 'noun');
              if (synonyms.length) {
                  synset.lexicalField = synset.lexicalField.concat(synonyms[0].close, synonyms[0].far);
              }
              return synset;
          });
      }

      if (includeHypernyms) {
          synsets = synsets.map(synset => {
              const hypernyms = exports.hypernyms(synset.id, 'noun', [], 1);
              if (hypernyms.length) {
                  synset.lexicalField = synset.lexicalField.concat(hypernyms[0].hypernyms);
              }
              //console.log(hypernyms);
              return synset;
          });
      }

      if (includeHyponyms) {
          synsets = synsets.map(synset => {
              const hyponyms = exports.hyponyms(synset.id, 'noun', 1);
              if (hyponyms.length) {
                  synset.lexicalField = synset.lexicalField.concat(hyponyms[0].hyponyms);
              }
              //console.log(hyponyms);
              return synset;
          });
      }

      if (includeHolonyms) {
          synsets = synsets.map(synset => {
              const holonyms = exports.holonyms(synset.id, 'noun', 1);
              if (holonyms.length) {
                  synset.lexicalField = synset.lexicalField.concat(holonyms[0].holonyms);
              }
              // console.log(holonyms);
              return synset;
          });
      }

      if (includeMeronyms) {
          synsets = synsets.map(synset => {
              const meronyms = exports.meronyms(synset.id, 'noun', 1);
              if (meronyms.length) {
                  synset.lexicalField = synset.lexicalField.concat(meronyms[0].meronyms);
              }
              // console.log(meronyms);
              return synset;
          });
      }

      const contextualTerms = relatedTerms.filter(term => term !== s);

      if (!contextualTerms.length) {
          return getIdsOfMostCommonMeaning(s, synsets);
      }

      const contextualIds = synsets.filter((synset, index) => contextualTerms.some(term => {
          return synset.lexicalField.includes(term)
        }))
        .map(synset => synset.id);

      /*
      const contextualIds = synsets.map((synset, index) => {
          synset.score = contextualTerms.filter(term => {
              return synset.lexicalField.includes(term)
          }).length;
          console.log(synset.id, synset.score);
          return synset;
      })
      .sort((a, b) => a.score - b.score)
      .filter((synset, index) => index === 0)
      .map(synset => synset.id);
      */

      if (!contextualIds.length && fallbackToFirst) {
          return getIdsOfMostCommonMeaning(s, synsets);
      }

      // console.log(contextualIds);
      return contextualIds;
  };


  exports.meronyms = function(s, pos, limit = -1) {
    return lookup(s, pos).map(syn => ({
        synset: syn.id,
        meronyms: getWords(reduceMeronyms,[syn.id], limit)
    }));
  };

  exports.holonyms = function(s, pos, limit = -1) {
    return lookup(s, pos).map(syn => ({
        synset: syn.id,
        holonyms: getWords(reduceHolonyms,[syn.id], limit)
    }));
  };

  exports.hyponyms = function(s, pos, limit = -1, callCount = 1) {
      return lookup(s, pos).map(syn => ({
          synset: syn.id,
          hyponyms: getWords(reduceHyponyms, [syn.id], limit, callCount)
      }));
  };

  exports.hypernyms = function(s, pos, stopList = [], limit = -1, callCount = 1) {
    return lookup(s, pos).map(syn => ({
        synset: syn.id,
        hypernyms: getWords(reduceHypernyms, [syn.id], limit, callCount, stopList)
    }));
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
