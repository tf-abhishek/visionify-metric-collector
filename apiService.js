import axios from 'axios';

/*export class ApiService {
    static async get(url) {
        return await axios.get(url);
    }
}*/
exports.get = async function(url) {
    return await axios.get(url);
};