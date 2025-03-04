import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import rideReducer from "./slices/rideSlice";
import notificationReducer from "./slices/notificationSlice";

const store = configureStore({
    reducer: {
        auth: authReducer,
        rides: rideReducer,
        notifications: notificationReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false,
    }),
});

export default store;
