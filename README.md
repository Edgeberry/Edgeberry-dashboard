![EdgeBerry](assets/Edgeberry_banner.png)

> **"One _Dashboard_ to rule them all, one _Dashboard_ to find them, one _Dashboard_ to _connect_ them all and _on the internet_ bind them"**

The Edgeberry Dashboard is an online asset management platform for [Edgeberry devices](https://github.com/SpuQ/Edgeberry). The official Edgeberry Dasboard is available on [Edgeberry.io](https://edgeberry.io/dashboard).

![Edgeberry Dashboard screenshot](assets/Edgeberry-dashboard.png)

## AWS IoT Core
### Device Registry
The device registry is a centralized database that stores information about the IoT devices. It keeps track of device details like connectivity status, device attributes, ...

Fleet indexing is enabled to organize and search for IoT devices efficiently. It creates a searchable index of your devices based on their attributes. This makes it easier to find and manage devices at scale.

```
TODO Edgeberry registry info
```
### Provisioning
```
AWS IoT > Connect many devices
```
#### Provisioning template
The provisioning template is a setup blueprint for adding new devices to your IoT system automatically. It includes all the necessary details, like certificates and policies, to get the devices up and running quickly.
```
AWS IoT > Connect many devices > Create provisioning template > with claim certificates
```

TODO: Change to JITP (Just in time provisioning)?
```
TODO: Edgeberry provisioning template
```
#### Registration credentials
TODO: info about the provisioning certificate and private key, etc.

### Thing type
```AWS IoT > Manage > Thing types```
The thing type in AWS IoT Core is a blueprint for similar groups of IoT devices. It defines the common characteristics, attributes and configurations shared among multiple devices of the same type.

```
Thing type
Thing type name: Edgeberry
Description:
The Edgeberry devices

Searchable attributes:
deviceOwner         // the ID of the device owner
deviceName          // the given name to the device
deviceGroup         // the group to which the device belongs
```

## Developer info
AWS setup for development:
- Create development User in AWS IAM
- Set User permissions (with policies)
- Create access key for development
- use development keyname and key in the development environment

## License & Collaboration
**Copyright© 2024 Sanne 'SpuQ' Santens**. The Edgeberry Dashboard project is licensed under the **[GNU GPLv3](LICENSE.txt)**.

### Collaboration

If you'd like to contribute to this project, please follow these guidelines:
1. Fork the repository and create your branch from `main`.
2. Make your changes and ensure they adhere to the project's coding style and conventions.
3. Test your changes thoroughly.
4. Ensure your commits are descriptive and well-documented.
5. Open a pull request, describing the changes you've made and the problem or feature they address.