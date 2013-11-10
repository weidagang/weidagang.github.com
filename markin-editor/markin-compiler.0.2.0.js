/*
 * markin-compiler.js v0.2.0
 * http://weidagang.github.io/markin-editor
 *
 * Copyright 2011, dagang.wei 
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * 
 * Contact: weidagang@gmail.com
 *
 * Date: 2013-11-06
 */

// constants 
var Line = {
    empty : 'empty',
    text : 'text', 
    title_1 : 'title1',
    title_2 : 'title2',
    title_3 : 'title3',
    title_4 : 'title4',
    line_equal : 'line_equal',
    line_minus : 'line_minus',
    line_dot : 'line_dot',
    quote_prefixed : 'quote_prefixed',
    line_back_quote : 'line_back_quote',
    code_begin: 'code_begin',
    code_end: 'code_end',
    line_greater : 'line_greater',
    quote_begin : 'quote_begin',
    quote_end : 'quote_end',
    table_begin : 'line_open_bracket',
    table_end : 'line_close_bracket',
    table_head : 'table_header',
    table_row : 'table_row' 
};

// utils
var utils = (function() {
    function _escape_regex(arg) {
        return arg.replace('\\', '\\\\').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)').replace('*', '\\*');
    }

    return { escape_regex : _escape_regex };
})();

var line_scanner = (function() {
    var _meta = [
        [ Line.empty, /^$/ ],
        [ Line.title_1, /^#/ ],
        [ Line.title_2, /^ #/ ],
        [ Line.title_3, /^  #/ ],
        [ Line.title_4, /^   #/ ],
        [ Line.line_equal, /^===/ ],
        [ Line.line_minus, /^---/ ],
        [ Line.line_dot, /^\.\.\./ ],
        [ Line.quote_prefixed, /^> / ],
        [ Line.line_back_quote, /^```/ ],
        [ Line.line_greater, /^>>>/ ],
        [ Line.table_begin, /^\[$/ ],
        [ Line.table_end, /^\]$/ ],
        [ Line.table_head, /^  \*\[.*\]\*$/ ],
        [ Line.table_row, /^   \[.*\]$/ ]
    ];

    function _parse(src) {
        var tokens = [];
        
        // phase 1 scan
        var raw_lines = src.split('\n');
        for (var i = 0; i < raw_lines.length; ++i) {
            var rline = raw_lines[i];
            var token = { type : Line.text, text : rline };   
            for (var j = 0; j < _meta.length; ++j) {
                if (_meta[j][1].test(rline)) {
                    token.type = _meta[j][0];
                    break;
                }
            }
            tokens.push(token);
        }
        
        // phase 2 scan
        var i = 0;
        var j = 0;
        while (i < tokens.length) {
            if (Line.line_back_quote == tokens[i].type) {
                for (j = i + 1; j < tokens.length; ++j) {
                    if (Line.line_back_quote == tokens[j].type) {
                        break;
                    }
                }

                if (j < tokens.length) {
                    tokens[i].type = Line.code_begin;
                    tokens[j].type = Line.code_end;
                    i = j + 1;
                    continue;
                }

                tokens[i].type = Line.Text;
            }

            if (Line.line_greater == tokens[i].type) {
                for (j = i + 1; j < tokens.length; ++j) {
                    if (Line.line_greater == tokens[j].type) {
                        break;
                    }
                }

                if (j < tokens.length) {
                    tokens[i].type = Line.quote_begin;
                    tokens[j].type = Line.quote_end;
                    i = j + 1;
                    continue;
                }

                tokens[i].type = Line.text;
            }

            ++i;
        }

        return tokens;
    }

    return { 
        parse : _parse 
    };
})();

var block_parser = (function() {
    function IS(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? 1 : -1;
        }
    }

    function NOT(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? -1 : 1;
        }
    }

    function OPTIONAL(line_type) {
        return function(lines, idx) {
            return (idx < lines.length && lines[idx].type == line_type) ? 1 : 0;
        }
    }

    function CONCAT() {
        var _args = arguments;

        return function(lines, idx) {
            var _idx = idx;
            for (var i = 0; i < _args.length; ++i) {
                var n = _args[i](lines, _idx);
                if (n < 0) {
                    return -1;
                }
                _idx += n;
            }
            return _idx - idx;
        }
    }


    function REPEAT(predicate, min, max) {
        var _min = (null != min ? min : 1);
        var _max = (null != max ? max : 1000000);

        return function(lines, idx) {
            var _idx = idx;
            var repeats = 0;
            while (_idx < lines.length && repeats < _max) {
                var n = predicate(lines, _idx);
                if (n < 0) {
                    if (repeats < min) {
                        return -1;
                    }
                    else {
                        return _idx - idx;
                    }
                }
                else {
                    ++repeats;
                    _idx += n;
                }
            }
            return _idx - idx;
        }
    }

    var _meta = [
        [ 'title_1', IS(Line.title_1) ],
        [ 'title_2', IS(Line.title_2) ],
        [ 'title_3', IS(Line.title_3) ],
        [ 'title_4', IS(Line.title_4) ],
        [ 'title_1_underlined', CONCAT(IS(Line.text), IS(Line.line_equal)) ],
        [ 'title_2_underlined', CONCAT(IS(Line.text), IS(Line.line_minus)) ],
        [ 'title_3_underlined', CONCAT(IS(Line.text), IS(Line.line_dot)) ],
        [ 'code', CONCAT(
                        IS(Line.code_begin), 
                        REPEAT(NOT(Line.code_end), 0), 
                        IS(Line.code_end)
                    )
        ],
        [ 'prefixed_quote', REPEAT(IS(Line.quote_prefixed), 1) ],
        [ 'enclosed_quote', CONCAT(
                                    IS(Line.quote_begin),
                                    REPEAT(NOT(Line.quote_end), 0),
                                    IS(Line.quote_end)
                                  )
        ],
        [ 'table', CONCAT(
                         IS(Line.table_begin), 
                         OPTIONAL(Line.table_head), 
                         REPEAT(IS(Line.table_row), 0), 
                         IS(Line.table_end)
                    ) 
        ],
        [ 'empty', REPEAT(IS(Line.empty), 1) ],
        [ 'text', REPEAT(IS(Line.text), 1) ]
    ];

    function _parse(lines) {
        var blocks = [];

        var idx = 0;
        while (idx < lines.length) {
            var matched = false;

            for (var i = 0; i < _meta.length; ++i) {
                var meta_block = _meta[i];
                var type = meta_block[0];
                var rule = meta_block[1];
                var n = rule(lines, idx);
                if (n > 0) {
                    matched = true;
                    blocks.push({ type : type, lines : lines.slice(idx, idx + n) });
                    idx += n;
                    break;
                }
            }

            if (!matched) {
                lines[idx].type = Line.text;
            }
        }

        return blocks;
    }

    return { parse : _parse };
})();

var html_generator = (function(){
    function _convert_text_line(line) {
        function convert_link(line) {
            return line.replace(/\[([^\]]+?)\]\(([^\)]+?)\)/g, '<a href="$2">$1</a>');
        }

        function convert_bold(line) {
            return convert_element(line, '**', 'strong');
        }

        function convert_italic(line) {
            return convert_element(line, '~~', 'i');
        }

        function convert_underline(line) {
            return convert_element(line, '__', 'u');
        }

        function convert_code(line) {
            return convert_element(line, '``', 'code');
        }

        function convert_emphasis(line) {
            return convert_element(line, '!!', 'mark');
        }

        function convert_element(line, mi_symbol, html_tag) {
            var startIdx = -1;
            var endIdx = -1;
            
            startIdx = line.indexOf(mi_symbol);
            while (startIdx >= 0) {
                endIdx = line.indexOf(mi_symbol, startIdx + 2);

                if (endIdx < 0) {
                    break; 
                }

                line = line.replace(mi_symbol, '<' + html_tag + '>'); 
                line = line.replace(mi_symbol, '</' + html_tag + '>'); 

                startIdx = line.indexOf(mi_symbol);
            }
            
            return line;
        }

        line = convert_link(line);
        line = convert_bold(line);
        line = convert_emphasis(line);
        line = convert_italic(line);
        line = convert_underline(line);
        line = convert_code(line);

        return line;
    }

    function _convert_text_block(block) {
        var html = []; 
        html.push('<p>');
        for (var i = 0; i < block.lines.length; ++i) {
            html.push(_convert_text_line(block.lines[i].text));
            html.push('<br>');
        }
        html.push('</p>');
        return html.join('');
    }

    function _convert_code_block(block) {
        var html = []; 
        html.push('<pre>');
        html.push('<code>');
        for (var i = 1; i < block.lines.length - 1; ++i) {
            html.push(block.lines[i].text + '\n');
        }
        html.push('</code>');
        html.push('</pre>');
        return html.join('');
    }

    function _convert_enclosed_quote_block(block) {
        var html = []; 
        html.push('<blockquote>');
        for (var i = 1; i < block.lines.length - 1; ++i) {
            html.push(block.lines[i].text);
            html.push('<br>');
        }
        html.push('</blockquote>');
        return html.join('');
    }

    function _convert_prefixed_quote_block(block) {
        var html = []; 
        html.push('<blockquote>');
        for (var i = 0; i < block.lines.length; ++i) {
            html.push(block.lines[i].text.substring(2));
            html.push('<br>');
        }
        html.push('</blockquote>');
        return html.join('');
    }

    function _convert_table_block(block) {
        var buffer = [];
        var lines = block.lines;

        buffer.push('<table>\n');
        
        if (lines.length > 2) {
            var offset = 1;

            var regex_header = /^\s*\*\[(.+)\]\*\s*$/
            var result_header = lines[1].text.match(regex_header);
            if (null != result_header) {
                buffer.push('<tr>');
                var heads = result_header[1].split(',');
                for (var i = 0; i < heads.length; ++i) {
                    buffer.push('<th>' + heads[i].replace(/^\s+|\s+$/, '') + '</th>');
                }
                buffer.push('</tr>\n');
                offset = 2;
            }

            var regex_td = /^\s*\[(.+)\]\s*$/
            for (var idx = offset; idx < lines.length - 1; ++idx) {
                var result_td = lines[idx].text.match(regex_td);
                if (null != result_td) {
                    buffer.push('<tr>');
                    var tds = result_td[1].split(',');
                    for (var i = 0; i < tds.length; ++i) {
                        buffer.push('<td>' + tds[i].replace(/^\s+|\s+$/, '') + '</td>');
                    }
                    buffer.push('</tr>\n');
                }
            }
        }

        buffer.push('</table>');

        return buffer.join('');
    }

    function _convert_title(block) {
        function title_level(line) {
            var i;
            var found = false;

            for (i = 0; i < line.length; ++i) {
                if ('#' == line[i]) {
                    found = true;
                    break;
                }
                else if (' ' != line[i]) {
                    break;
                }
            }
            
            return found ? i + 1 : 0;
        }
       
        var buffer = [];
        var rline = block.lines[0].text;
        var level = title_level(rline);

        buffer.push('<h' + level + '>');
        buffer.push(rline.replace(/^(\s*#+\s*)?/, "").replace(/\s*#+$/, ""));
        buffer.push('</h' + level + '>');

        return buffer.join('');
    }

    function _convert_underlined_title(block) {
        var level = 1;
        if ('title_1_underlined' == block.type) {
            level = 1;
        }
        else if('title_2_underlined' == block.type) {
            level = 2;
        }
        else if('title_3_underlined' == block.type) {
            level = 3;
        }
        return '<h' + level + '>' + block.lines[0].text + '</h' + level + '>';
    }

    var _meta = {
        'text' : _convert_text_block,
        'code' : _convert_code_block,
        'enclosed_quote' : _convert_enclosed_quote_block,
        'prefixed_quote' : _convert_prefixed_quote_block,
        'table' : _convert_table_block,
        'title_1' : _convert_title,
        'title_2' : _convert_title,
        'title_3' : _convert_title,
        'title_4' : _convert_title,
        'title_1_underlined' : _convert_underlined_title,
        'title_2_underlined' : _convert_underlined_title,
        'title_3_underlined' : _convert_underlined_title
    };

    function _generate(blocks) {
        var html = [];
        for (var i = 0; i < blocks.length; ++i) {
            var converter = _meta[blocks[i].type];
            if (null != converter) {
                html.push(converter(blocks[i]));
            }
        }
        return html.join('\n');
    }

    return { generate : _generate };
})();

function compile(src) {
    var lines = line_scanner.parse(src);

    var blocks = block_parser.parse(lines);

    var html = html_generator.generate(blocks);

    return html;
}

