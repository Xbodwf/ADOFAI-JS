import StringParser from './StringParser';

class Parser {
    static parseError(f: string) {
        return f;
    }

    /**
        * @param {string} t - Input Content
        * @param {object} provider - Third-party JSON Parser
        * @returns {object} ADOFAI File Object
    */
    static parseAsObject(t: string, provider?: any) {
        return (typeof provider == 'undefined' ? StringParser : provider).parse(Parser.parseAsText(t));
    }

    /**
        * @param {string} t - Input Content
        * @returns {string} ADOFAI File Content
    */
    static parseAsText(t: string) {
        return this.parseError(t);
    }
}

export default Parser