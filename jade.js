/*global __moduleName*/
import Jade from 'jade-compiler'

export function translate (load) {
  return Promise.all([
    expand_text({source: load.source, address: load.address}),
    get_runtime_loc(__moduleName)
  ])
    .then(function (values) {
      let [text, runtime_loc] = values
      // Note: mask "require" by separating from  left parenthesis to prevent
      // dependency processing on module load.
      //
      return 'var jade = require' + '("' + runtime_loc + '");\n\n' +
        'module.exports = ' + Jade.compileClient(text)
    })
}

function get_runtime_loc (module_name) {
  return System.normalize('jade-compiler/lib/runtime', module_name)
}

function expand_text ({source, address}) {
  let {ex_includes, includes} = parse_includes(source)
  return fetch_includes({includes, parent_address: address})
    .then(fetched_includes => assemble({ex_includes, includes, fetched_includes}))
}

function parse_includes (source) {
  source = source.replace(/\r\n|\r/g, '\n')
  let include_regexp = /^([ \t]*)include[ \t]+(\S+)[ \t]*$/img
  let ex_includes = []
  let includes = []

  let inc_match
  let start_index = 0
  while ((inc_match = include_regexp.exec(source)) !== null) {
//    console.log(start_index, inc_match.index, include_regexp.lastIndex)
    ex_includes.push(source.substring(start_index, inc_match.index))
    includes.push({
      indent_str: inc_match[1],
      file_path: inc_match[2]
    })
    start_index = include_regexp.lastIndex + 1
  }

  ex_includes.push(source.substring(start_index, source.length))
  return {
    ex_includes: ex_includes,
    includes: includes
  }
}

function fetch_includes ({includes, parent_address}) {
  let parent_dir = parent_address.replace(/^(.+\/)*(.+)$/, '$1')
  return Promise.all(
    includes.map(include =>
      System.import(parent_dir + include.file_path + '!text')
        .then(text => text.charAt(text.length - 1) === '\n' ? text : text + '\n')
      )
    )
}

function assemble ({ex_includes, includes, fetched_includes}) {
  let res = ''
  let i = 0
  while (i < includes.length) {
    res += ex_includes[i] +
      indent({
        text: fetched_includes[i],
        indent_str: includes[i].indent_str
      })
    i++
  }
  return res + ex_includes[i]
}

function indent ({text, indent_str}) {
  return text.replace(/\r\n|\r|\n/g, '\n')
    .split('\n')
    .map(line => indent_str + line)
    .join('\n')
}
