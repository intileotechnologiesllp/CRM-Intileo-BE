// REFACTORED: Models now passed as parameters to support dynamic databases

exports.checkGroupVisibilty = async(userId, groupName, GroupVisibility) =>{
    try{    
        const findGroup = GroupVisibility.findOne({
            where: {
                groupName: groupName
            }
        })

        if(!findGroup){
            return res.status(404).json({ message: 'Visibility group not found.' });
        }
        const memberIds = findGroup.memberIds ? findGroup.memberIds.split(',').map(id => parseInt(id)) : [];

        if(!memberIds.includes(userId)){
            return res.status(403).json({ message: 'You do not have access to this group.' });
        }
        return findGroup;
    }catch(error){
        console.error("Error checking group visibility:", error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}