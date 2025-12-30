import request from './request';

class UserService {
    /**
     * 创建总部/基地用户
     * @param {Object} data 
     */
    static createUser(data) {
        return request.post('/api/v1/hq/users', data);
    }
}

export default UserService;
