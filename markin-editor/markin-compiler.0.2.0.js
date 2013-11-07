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
    empty : 'Empty',
    text : 'Text', 
    title_1 : 'Title1',
    title_2 : 'Title2',
    title_3 : 'Title3',
    title_4 : 'Title4',
    line_equal : 'LineEqual',
    line_minus : 'LineMinus',
    line_dot : 'LineDot',
    quote_single : 'QuoteSingle',
    code_multi : 'CodeMulti',
    code_begin: 'CodeBegin',
    code_end: 'CodeEnd',
    quote_multi : 'QuoteMulti',
    quote_begin : 'QuoteBegin',
    quote_end : 'QuoteEnd',
    table_begin : 'TableBegin',
    table_end : 'TableEnd',
    table_head : 'TableHead',
    table_data : 'TableData' 
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
        [ Line.empty, _equals('') ],
        [ Line.title_1, _starts_with('#') ],
        [ Line.title_2, _starts_with(' #') ],
        [ Line.title_3, _starts_with('  #') ],
        [ Line.title_4, _starts_with('   #') ],
        [ Line.line_equal, _repeats('=', 3) ],
        [ Line.line_minus, _repeats('-', 3) ],
        [ Line.line_dot, _repeats('.', 3) ],
        [ Line.quote_single, _starts_with('> ') ],
        [ Line.code_multi, _starts_with('```') ],
        [ Line.quote_multi, _starts_with('>>>')],
        [ Line.table_begin, _equals('[')],
        [ Line.table_end, _equals(']')],
        [ Line.table_head, _enclosed_by('*[', ']*')],
        [ Line.table_data, _enclosed_by('[', ']')]
    ];
    
    // matches lines that equal to arg
    function _equals(arg) {
        return function (line) {
            return line == arg;
        };
    }
    
    // matches lines that start with arg
    function _starts_with(arg) {
        return function(line) {
            return null != line && 0 == line.indexOf(arg);
        }
    }

    // matches lines which are enclosed by arg1 and arg2
    function _enclosed_by(arg1, arg2) {
        return function(line) {
            var _arg1 = utils.escape_regex(arg1);
            var _arg2 = utils.escape_regex(arg2);
            var regex = new RegExp('^\\s*' + _arg1 + '.*' + _arg2 + '\\s*$');
            return regex.test(line); 
        }
    }

    // matches repeats of a symbol
    function _repeats(symbol, times) {
        return function (line) {
            if (null != line && line.length > times) {
                for (var i = 0; i < line.length; ++i) {
                    if (line.charAt(i) != symbol) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }
    }
    //// - matcher    

    function _parse(src) {
        var tokens = [];
        
        // phase 1 scan
        var raw_lines = src.split('\n');
        for (var i = 0; i < raw_lines.length; ++i) {
            var rline = raw_lines[i];
            var token = { type : Line.text, text : rline };   
            for (var j = 0; j < _meta.length; ++j) {
                if (_meta[j][1](rline)) {
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
            if (Line.code_multi == tokens[i].type) {
                for (j = i + 1; j < tokens.length; ++j) {
                    if (Line.code_multi == tokens[j].type) {
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

            if (Line.quote_multi == tokens[i].type) {
                for (j = i + 1; j < tokens.length; ++j) {
                    if (Line.quote_multi == tokens[j].type) {
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

/*
var syntax = (function() {
    
    var meta_syntax = {
        rules : [
            [ 'title_1', title(1) ],
            [ 'title_2', title(2) ],
            [ 'title_3', title(3) ],
            [ 'title_4', title(4) ],
            [ 'quote_block_single', REPEAT(quote_single, 1) ],
            [ 'code_block', CONCAT(code_begin, (NOT(code_end)), code_end) ],
            [ 'quote_block_multi', CONCAT(quote_begin, (NOT(quote_end)), quote_end) ],
        ]
    };
})();
*/

function compile(src) {
    var tokens = line_scanner.parse(src);
    for (var i = 0; i < tokens.length; ++i) {
        console.log(tokens[i]);
    }
}

